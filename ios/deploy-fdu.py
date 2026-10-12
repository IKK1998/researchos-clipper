"""Run on audited remote host only; exact static overlay, guarded reversible web release."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--release', required=True)
    parser.add_argument('--base-image', required=True)
    parser.add_argument('--base-tag', required=True)
    parser.add_argument('--docker-socket', required=True)
    parser.add_argument('--rollback', action='store_true')
    args = parser.parse_args()
    os.umask(0o077)
    root = Path(args.root).resolve()
    assert root.is_dir() and root != Path('/') and args.release.startswith('iphone-collect-')
    rel = root / 'releases' / args.release
    code = rel / 'code'
    assert Path(__file__).resolve() == code / 'ios/deploy-fdu.py'
    env = dict(os.environ, DOCKER_HOST='unix://' + args.docker_socket)
    def run(command, timeout=120):
        p = subprocess.run(command, env=env, capture_output=True, timeout=timeout)
        if p.returncode: raise RuntimeError('Scoped command failed: '+str(command[:3]))
        return p.stdout
    def inspect(name): return json.loads(run(['docker','inspect',name]))[0]
    def web(): return inspect('aging-cachexia-researchos-web-1')
    def protected():
        names = run(['docker','ps','-a','--format','{{.Names}}']).decode().splitlines()
        return {n: {'image':inspect(n)['Image'], 'started':inspect(n)['State']['StartedAt'],
            'config_hash':hashlib.sha256(json.dumps(inspect(n)['Config'],sort_keys=True).encode()).hexdigest()}
            for n in sorted(names) if n.startswith(('aging-cachexia-researchos-','researchos-public-tunnel')) and n != 'aging-cachexia-researchos-web-1'}
    def sql(query): return run(['docker','exec','aging-cachexia-researchos-db-1','psql','-U','research_os','-d','research_os','-Atc',query]).decode().strip()
    def idle():
        for table in ['document_tasks','learning_turns','topic_turns','ingestion_jobs']:
            if sql("SELECT to_regclass('public."+table+"')"):
                assert sql("SELECT count(*) FROM "+table+" WHERE status IN ('queued','running')") == '0', 'Active tasks'
    def put(name,value):
        with (rel/name).open('x') as f: json.dump(value,f,indent=2)
    def compose(profile, rollback=False):
        command = ['docker','compose']
        for p in profile['env']: command += ['--env-file',p]
        for p in profile['files']: command += ['-f',p]
        command += ['-f',str(rel/('rollback.json' if rollback else 'override.json')),'up','-d','--no-build','--no-deps','web']
        run(command,180)
        run(['docker','exec','aging-cachexia-researchos-gateway-1','nginx','-t'])
        run(['docker','exec','aging-cachexia-researchos-gateway-1','nginx','-s','reload'])
    if args.rollback:
        recovery = json.loads((rel/'recovery.json').read_text());idle();compose(recovery['profile'],True)
        print('IPHONE_WEB_ROLLED_BACK');return
    assert not (rel/'recovery.json').exists(), 'Do not overwrite an existing release'
    assert shutil.disk_usage(root).free > 3_000_000_000
    for item in json.loads((code/'ios/release-manifest.json').read_text())['files']:
        p = code/item['path'];assert code.resolve() in p.resolve().parents
        assert p.stat().st_size == item['size_bytes'] and hashlib.sha256(p.read_bytes()).hexdigest() == item['sha256']
    current = web();assert current['Image'] == args.base_image, 'Web base drift'
    labels = current['Config']['Labels']
    profile = {'files':labels['com.docker.compose.project.config_files'].split(','),'env':labels['com.docker.compose.project.environment_file'].split(',')}
    assert all(root in Path(p).resolve().parents for p in profile['files']+profile['env'])
    configs = {p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in profile['files']+profile['env']}
    assert json.loads(run(['docker','image','inspect',args.base_tag]))[0]['Id'] == args.base_image
    idle();before = protected();calls = sql('SELECT count(*) FROM model_calls')
    recovery = {'image':args.base_image,'profile':profile,'configs':configs,'protected':before}
    put('recovery.json',recovery);put('rollback.json',{'services':{'web':{'image':args.base_image}}})
    tag = 'researchos-release/web:'+args.release
    assert not run(['docker','image','ls','-q',tag]).strip()
    log = run(['docker','build','--pull=false','--network=none','--build-arg','BASE_IMAGE='+args.base_tag,'-f',str(code/'ios/Dockerfile'),'-t',tag,str(code)],180)
    (rel/'build.log').write_bytes(log)
    # No new dependencies/build, API routes, server bundles or anatomy asset changes.
    for p in ['/app/app/api/[...path]/route.ts','/app/public/atlas-assets/1c38bf35c254a891200d3cedecfd57abebe83d8d/atlas.json']:
        old = run(['docker','exec','aging-cachexia-researchos-web-1','sha256sum',p])
        new = run(['docker','run','--rm','--network=none','--entrypoint','sha256sum',tag,p])
        assert old == new
    put('override.json',{'services':{'web':{'image':tag}}})
    idle();assert web()['Image'] == args.base_image and protected() == before
    assert configs == {p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in configs}
    try:
        compose(profile)
        for _ in range(30):
            if web()['State'].get('Health',{}).get('Status') == 'healthy': break
            time.sleep(2)
        else: raise RuntimeError('Web health failed')
        html = run(['docker','exec','aging-cachexia-researchos-gateway-1','wget','-q','-O','-','http://web:3000/phone-collect/index.html']).decode()
        assert 'iphone-collect-20261012-v1' in html and '确认收藏' in html
        for filename in ['collect-core.mjs','collect-page.mjs','ResearchOS-Collect.shortcut']:
            content = run(['docker','exec','aging-cachexia-researchos-gateway-1','wget','-q','-O','-','http://web:3000/phone-collect/'+filename])
            assert hashlib.sha256(content).hexdigest() == hashlib.sha256((code/'ios'/filename).read_bytes()).hexdigest()
        assert protected() == before and sql('SELECT count(*) FROM model_calls') == calls
        put('ACTIVATED.json',{'image':web()['Image'],'protected_unchanged':True,'schema_changes':False,'model_calls':0,'static_hashes_verified':True,'iphone_acceptance':False})
        print('IPHONE_WEB_ACTIVATED')
    except Exception:
        compose(profile,True);raise

if __name__ == '__main__': main()
