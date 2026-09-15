"use strict";
const { createSandbox, loadCore, load } = require("./harness");

function ctxFor(pathname) {
  const sb = createSandbox({ pathname });
  loadCore(sb);
  load(sb, "src/content/core/detect.js");
  sb.location.pathname = pathname;
  return sb.BC.detect.context();
}

module.exports = {
  "canvas routes map to the expected page names"() {
    const cases = {
      "/": "dashboard",
      "/dashboard": "dashboard",
      "/courses/12/grades": "grades",
      "/courses/12/gradebook": "gradebook",
      "/courses/12/modules": "modules",
      "/courses/12/assignments": "assignments",
      "/courses/12/assignments/syllabus": "assignments",
      "/courses/12/assignments/34": "assignment",
      "/courses/12/discussion_topics/9": "discussions",
      "/courses/12/announcements": "announcements",
      "/courses/12/files": "files",
      "/courses/12/pages/home": "pages",
      "/courses/12/users": "course",
      "/courses/12/quizzes/5/take": "course",
      "/courses/12": "course",
      "/calendar": "calendar",
      "/conversations": "inbox",
      "/profile/settings": "profile",
      "/files": "files",
      "/unknown/thing": "other",
    };
    for (const [path, page] of Object.entries(cases)) {
      assert.equal(ctxFor(path).page, page, `${path} should be "${page}"`);
    }
  },

  "the syllabus route resolves to assignments, which is what the feature declares"() {
    // syllabus.js declares pages:["assignments"]; if this mapping changed the
    // feature would silently never run.
    assert.equal(ctxFor("/courses/1/assignments/syllabus").page, "assignments");
  },

  "a quiz-taking route resolves to course, which is what quizsaver declares"() {
    assert.equal(ctxFor("/courses/1/quizzes/2/take").page, "course");
  },

  "an assignment detail page is distinct from the assignment index"() {
    // grades.js scopes the rubric predictor to "assignment" only.
    assert.equal(ctxFor("/courses/1/assignments/2").page, "assignment");
    assert.equal(ctxFor("/courses/1/assignments").page, "assignments");
  },

  "the course id is extracted wherever there is one"() {
    assert.equal(ctxFor("/courses/987/grades").courseId, "987");
    assert.equal(ctxFor("/calendar").courseId, null);
  },

  "isInstructureDomain only matches the real domain and its subdomains"() {
    const check = (hostname) => {
      const sb = createSandbox();
      loadCore(sb);
      load(sb, "src/content/core/detect.js");
      sb.location.hostname = hostname;
      return sb.BC.detect.isInstructureDomain();
    };
    assert.ok(check("school.instructure.com"));
    assert.ok(check("instructure.com"));
    assert.notOk(check("evil-instructure.com"), "a suffix match would trust an attacker domain");
    assert.notOk(check("instructure.com.evil.test"));
    assert.notOk(check("canvas.school.edu"));
  },
};
