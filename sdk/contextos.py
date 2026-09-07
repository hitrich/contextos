"""Dependency-free client for the trusted localhost owner API (Python 3.10+)."""
import json
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


class ContextOS:
    def __init__(self, url="http://127.0.0.1:3000"):
        self.url = url.rstrip("/")

    def request(self, path, method="GET", body=None):
        data = json.dumps(body).encode() if body is not None else None
        request = Request(self.url + "/api" + path, data=data, method=method,
                          headers={"Content-Type": "application/json"} if data else {})
        try:
            with urlopen(request, timeout=30) as response:
                return json.load(response)
        except HTTPError as error:
            try:
                message = json.loads(error.read()).get("error", str(error))
            except (ValueError, AttributeError):
                message = str(error)
            raise RuntimeError(message) from error

    def recall(self, query=""):
        return self.request("/memories?" + urlencode({"q": query}))

    def get(self, memory_id):
        return self.request("/memories/" + quote(memory_id, safe=""))

    def remember(self, memory):
        memory_id = memory.get("id")
        return self.request("/memories" + ("/" + quote(memory_id, safe="") if memory_id else ""),
                            "PUT" if memory_id else "POST", memory)

    def history(self, query=""):
        return self.request("/events?" + urlencode({"q": query}))

    def handoff(self, packet):
        return self.request("/handoffs", "POST", packet)

    def export(self):
        return self.request("/export")

    def import_archive(self, archive):
        return self.request("/import", "POST", archive)

    def tool(self, name, arguments=None, agent="opencode"):
        return self.request("/tools/call", "POST", {"name": name, "arguments": arguments or {}, "agent": agent})
