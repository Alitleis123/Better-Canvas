/*
 * Better Canvas — Canvas REST API helper.
 * Runs in the content script on the Canvas origin, so fetch uses the user's
 * existing session cookies. Mostly read-only (GET); the only writes are
 * user-initiated changes to the user's OWN planner (mark a task complete, add
 * a personal task) used by the custom To Do widget. Nothing is sent off-domain.
 */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});
  const base = location.origin;

  // Canvas guards mutating requests with a CSRF token mirrored in the
  // "_csrf_token" cookie (URL-encoded). Echo it back in the X-CSRF-Token header.
  function csrfToken() {
    const m = document.cookie.match(/(?:^|;\s*)_csrf_token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function parseNextLink(linkHeader) {
    if (!linkHeader) return null;
    for (const part of linkHeader.split(",")) {
      const m = part.match(/<([^>]+)>\s*;\s*rel="next"/);
      if (m) return m[1];
    }
    return null;
  }

  const api = (BC.api = {
    // GET a single JSON endpoint. Returns parsed body or throws.
    async getJSON(path) {
      const url = path.startsWith("http") ? path : base + path;
      const res = await fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json+canvas-string-ids, application/json" },
      });
      if (!res.ok) throw new Error("Canvas API " + res.status + " for " + path);
      const text = await res.text();
      // Canvas prefixes JSON with "while(1);" as anti-JSON-hijacking.
      return JSON.parse(text.replace(/^while\(1\);?/, ""));
    },

    // GET a paginated list endpoint, following rel="next" until exhausted.
    async getList(path, maxPages = 20) {
      let url = path.startsWith("http") ? path : base + path;
      const out = [];
      let pages = 0;
      while (url && pages < maxPages) {
        const res = await fetch(url, {
          credentials: "include",
          headers: {
            Accept: "application/json+canvas-string-ids, application/json",
          },
        });
        if (!res.ok) throw new Error("Canvas API " + res.status);
        const text = await res.text();
        const data = JSON.parse(text.replace(/^while\(1\);?/, ""));
        if (Array.isArray(data)) out.push(...data);
        url = parseNextLink(res.headers.get("Link"));
        pages++;
      }
      return out;
    },

    self() {
      return api.getJSON("/api/v1/users/self");
    },

    dashboardCards() {
      return api.getJSON("/api/v1/dashboard/dashboard_cards");
    },

    // Active courses with current/final scores for the GPA calculator.
    coursesWithScores() {
      return api.getList(
        "/api/v1/courses?enrollment_state=active&enrollment_type=student" +
          "&include[]=total_scores&include[]=concluded&per_page=100"
      );
    },

    assignmentGroups(courseId) {
      return api.getList(
        `/api/v1/courses/${courseId}/assignment_groups` +
          "?include[]=assignments&include[]=submission&per_page=100"
      );
    },

    // ---- Planner (powers the custom To Do widget) -----------------------
    // Items between two dates (ISO strings). Each carries plannable_type,
    // plannable (the assignment/quiz/note), planner_override, and dates.
    plannerItems(startISO, endISO) {
      return api.getList(
        "/api/v1/planner/items?per_page=50" +
          (startISO ? "&start_date=" + encodeURIComponent(startISO) : "") +
          (endISO ? "&end_date=" + encodeURIComponent(endISO) : ""),
        6
      );
    },

    // Mark a planner item complete/incomplete. Updates the existing override
    // when one exists, else creates one. Resolves to the override object.
    async setPlannerComplete(plannableType, plannableId, complete, overrideId) {
      const method = overrideId ? "PUT" : "POST";
      const path = overrideId
        ? "/api/v1/planner/overrides/" + overrideId
        : "/api/v1/planner/overrides";
      const body = overrideId
        ? { marked_complete: !!complete }
        : {
            plannable_type: plannableType,
            plannable_id: plannableId,
            marked_complete: !!complete,
          };
      return api.mutate(method, path, body);
    },

    // Create a personal planner note (a custom To Do entry).
    createPlannerNote({ title, todoDate, courseId }) {
      const body = { title: title, todo_date: todoDate };
      if (courseId) body.course_id = courseId;
      return api.mutate("POST", "/api/v1/planner_notes", body);
    },

    // Authenticated JSON mutation with CSRF. Throws on non-2xx.
    async mutate(method, path, body) {
      const url = path.startsWith("http") ? path : base + path;
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          Accept: "application/json+canvas-string-ids, application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken(),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Canvas API " + res.status + " for " + path);
      const text = await res.text();
      return text ? JSON.parse(text.replace(/^while\(1\);?/, "")) : null;
    },
  });
})();
