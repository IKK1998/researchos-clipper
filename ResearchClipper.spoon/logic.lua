local M = {}
function M.link(text)
  if type(text) ~= 'string' or #text > 4096 then return nil end
  local value = text:match('^%s*(.-)%s*$')
  if value == '' or value:find('[%s%c]') or value:find('[<>"\\]') then return nil end
  local rest = value:match('^https://mp%.weixin%.qq%.com(/.*)$')
  if not rest or not (rest:match('^/s/[%w_%-]+[?#]?.*$') or rest:match('^/s%?[^#]+')) then return nil end
  -- Fragments are local reading positions; preserve query parameters required by WeChat.
  return value:gsub('#.*$', '')
end
function M.endpoint(base)
  if type(base) ~= 'string' then return nil end
  local port = base:match('^http://127%.0%.0%.1:(%d+)$')
  if not port or tonumber(port)<1 or tonumber(port)>65535 then return nil end
  return base .. '/api/v1/intake'
end
function M.result(code, body, decode)
  if code == 401 or code == 403 then return false, '访问被拒绝，请检查私有通道授权' end
  if code >= 300 and code < 400 then return false, '收到登录或重定向响应，未确认保存' end
  if code < 0 then return false, '连接失败；请检查私有通道，稍后手动重试' end
  if code < 200 or code >= 300 then return false, '服务器返回错误，未确认保存（' .. tostring(code) .. '）' end
  if type(body)~='string' or #body>65536 then return false, '响应异常，未确认保存' end
  local ok, data = pcall(decode, body)
  if not ok or type(data)~='table' or data.saved~=true or type(data.source_id)~='string'
    or not data.source_id:match('^[%x]+%-%x+%-%x+%-%x+%-%x+$') then
    return false, '未收到有效保存凭据，请到资料库核对'
  end
  return true, data.duplicate and '资料库已有此链接，无需重复保存' or '已保存到资料库；正文与总结状态请在网站查看'
end
return M
