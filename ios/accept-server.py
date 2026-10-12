"""One owner-selected, already-saved URL; run inside the existing API container."""
import argparse
import json
import urllib.parse
import urllib.request

def main():
    p = argparse.ArgumentParser();p.add_argument('article_url');args = p.parse_args()
    article = args.article_url
    u = urllib.parse.urlparse(article)
    assert u.scheme == 'https' and u.netloc == 'mp.weixin.qq.com' and u.path.startswith('/s/')
    def request(path,payload=None):
        data = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request('http://gateway'+path,data=data,headers={'Content-Type':'application/json'},method='POST' if data else 'GET')
        with urllib.request.urlopen(req,timeout=25) as reply:
            assert reply.status == 200 and 'application/json' in reply.headers.get('Content-Type','')
            return json.load(reply)
    def candidates(q): return request('/api/v1/library?'+urllib.parse.urlencode({'q':q,'limit':'20','offset':'0'}))['items']
    matches = [x for x in candidates(article) if x.get('original_value') == article or x.get('url') == article]
    # The library may name its source URL field differently; detail verification is authoritative.
    if not matches:
        for item in candidates(article):
            sid = item.get('source_id')
            if sid and request('/api/v1/sources/'+sid)['source']['original_value'] == article: matches.append(item)
    assert len(matches) == 1, 'Do not create a new source as acceptance; owner URL must exist exactly once'
    original_id = matches[0]['source_id']
    receipt = request('/api/v1/intake',{'value':article,'source_kind':'wechat','fill_missing_title':True,'ai_consent':False})
    assert receipt['saved'] is True and receipt['duplicate'] is True and receipt['source_id'] == original_id
    source = request('/api/v1/sources/'+original_id)['source']
    assert source['id'] == original_id and source['original_value'] == article
    provenance = source.get('provenance') or {}
    if isinstance(provenance,str):provenance = json.loads(provenance)
    title = provenance.get('title') or ''
    keyword_found = any(x.get('source_id') == original_id for x in candidates(title[:12])) if title else None
    print(json.dumps({'saved':True,'duplicate':True,'source_readback':True,'title_available':bool(title),'keyword_search':keyword_found,'ai_consent':False,'new_source_created':False}))

if __name__ == '__main__':main()
