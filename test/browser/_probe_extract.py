# Pull the harness's result block out of a --dump-dom capture.
#
# The id differs per page: the probe and the measure sweep print into <pre
# id="out">, live.html into <pre id="bc-out">. Pass the id as the first
# argument; it defaults to the probe's.
import sys, re, html

want = sys.argv[1] if len(sys.argv) > 1 else "out"
s = sys.stdin.read()
# The element may carry attributes after its id (live.html styles its own
# output block inline), so match up to the end of the open tag rather than
# assuming the id is the last thing in it.
m = re.search(r'<pre id="%s"[^>]*>(.*?)</pre>' % re.escape(want), s, re.S)
print(html.unescape(m.group(1)) if m else "NO OUTPUT BLOCK (#%s)\n%s" % (want, s[:600]))
