/* ============================================
   DebraWylde.world - Assessment Flow (Frontend Only)
   ============================================ */
(function () {
  "use strict";

  if (!document.body.classList.contains("assessment-page")) {
    return;
  }

  const STORAGE_KEY = "alignment_assessment_submission";
  const UNLOCK_KEY = "alignment_report_unlocked";

  const tieBreakPriority = [
    "Aligned Leadership™",
    "Decisive Expansion",
    "Vision & Architecture",
    "Identity Shift",
    "Strategic Disquiet"
  ];

  const questions = [
    { id: 1, group: "Strategic Disquiet", text: "My current role, business, or way of working no longer feels like a true fit." },
    { id: 2, group: "Strategic Disquiet", text: "I've built success, but something feels misaligned beneath the surface." },
    { id: 3, group: "Strategic Disquiet", text: "I can feel that a change is needed, even if I can't fully articulate it yet." },
    { id: 4, group: "Identity Shift", text: "I feel like I am outgrowing the role or identity I have been known for." },
    { id: 5, group: "Identity Shift", text: "I am releasing old expectations about who I should be." },
    { id: 6, group: "Identity Shift", text: "I sense that the version of me that created this chapter is not the one who will lead the next." },
    { id: 7, group: "Vision & Architecture", text: "I can feel a new direction emerging, but it is not yet fully defined." },
    { id: 8, group: "Vision & Architecture", text: "I need clearer structure around what I am building next." },
    { id: 9, group: "Vision & Architecture", text: "I am ready to translate what I sense into a more strategic vision." },
    { id: 10, group: "Decisive Expansion", text: "I know what needs to happen next, and I am ready to move with clarity." },
    { id: 11, group: "Decisive Expansion", text: "I am becoming more decisive about what stays and what no longer belongs." },
    { id: 12, group: "Decisive Expansion", text: "I am willing to expand into a bigger version of leadership." },
    { id: 13, group: "Aligned Leadership™", text: "My work, identity, and direction feel deeply integrated." },
    { id: 14, group: "Aligned Leadership™", text: "I am leading from a place of clarity rather than reaction." },
    { id: 15, group: "Aligned Leadership™", text: "I feel aligned with what I am building and how I am building it." }
  ];

  const answerScale = [
    { value: 1, label: "Not true for me" },
    { value: 2, label: "Rarely true" },
    { value: 3, label: "Sometimes true" },
    { value: 4, label: "Mostly true" },
    { value: 5, label: "Strongly true" }
  ];

  const resultsByStage = {
    "Strategic Disquiet": {
      headline: "Strategic Disquiet",
      subheadline: "Something no longer fits",
      body: "You've built success, but something in your current way of working no longer reflects who you are becoming. This stage is often subtle at first. Outwardly, everything may still appear functional. Internally, however, the misalignment is already present. This is not failure. It is the beginning of awareness.",
      requires: "Recognition, honesty, and space to acknowledge what is no longer aligned."
    },
    "Identity Shift": {
      headline: "Identity Shift",
      subheadline: "Releasing the old role",
      body: "You are no longer who you were when this chapter began. The familiar identity, role, or professional shape that once served you is starting to fall away. This stage can feel uncertain, but it is also necessary. Before your next direction becomes clear, an old version of self often has to be released.",
      requires: "Permission to let go, trust in transition, and support in redefining who you are becoming."
    },
    "Vision & Architecture": {
      headline: "Vision & Architecture",
      subheadline: "Designing what's next",
      body: "The shift is no longer only internal. You are beginning to sense a new direction and are ready to give it form. This is the point where insight must become structure. You do not need more noise. You need a clear architecture for what comes next.",
      requires: "Strategy, design, structure, and a clear framework for your next chapter."
    },
    "Decisive Expansion": {
      headline: "Decisive Expansion",
      subheadline: "Moving with clarity",
      body: "You are no longer waiting for certainty to appear. You are ready to move. This stage is about making clean decisions, choosing what matters, and stepping into a larger level of leadership with precision. Momentum comes from clarity, not force.",
      requires: "Decisive action, strategic refinement, and confident expansion."
    },
    "Aligned Leadership™": {
      headline: "Aligned Leadership™",
      subheadline: "Leading from alignment",
      body: "Your work, identity, and direction are becoming fully integrated. This stage is not about beginning again. It is about leading from coherence, depth, and strategic alignment. This is where your leadership becomes more powerful because it is no longer divided.",
      requires: "Sustained refinement, deeper embodiment, and expansion from an aligned core."
    }
  };

  function applyCRMTag(resultStage) {
    const map = {
      "Strategic Disquiet": "AA - Strategic Disquiet",
      "Identity Shift": "AA - Identity Shift",
      "Vision & Architecture": "AA - Vision & Architecture",
      "Decisive Expansion": "AA - Decisive Expansion",
      "Aligned Leadership™": "AA - Aligned Leadership"
    };
    const tag = map[resultStage] || "AA - Unassigned";
    console.log("[Assessment] CRM tag applied:", tag);
    return tag;
  }

  const state = {
    screen: "intro",
    currentQuestionIndex: 0,
    answersById: {},
    user: {
      first_name: "",
      email: ""
    },
    isUnlocked: false
  };

  const panelIntro = document.getElementById("panel-intro");
  const panelQuestions = document.getElementById("panel-questions");
  const panelLead = document.getElementById("panel-lead");
  const panelPaywall = document.getElementById("panel-paywall");
  const panelResults = document.getElementById("panel-results");

  const progressText = document.getElementById("progress-text");
  const progressBar = document.getElementById("progress-bar");
  const questionGroup = document.getElementById("question-group");
  const questionText = document.getElementById("question-text");
  const questionOptions = document.getElementById("question-options");

  const questionBack = document.getElementById("question-back");
  const questionNext = document.getElementById("question-next");
  const startBtn = document.getElementById("start-assessment");
  const leadForm = document.getElementById("lead-form");
  const leadBack = document.getElementById("lead-back");
  const paywallBack = document.getElementById("paywall-back");
  const unlockBtn = document.getElementById("unlock-report");

  const resultTitle = document.getElementById("result-title");
  const resultSubtitle = document.getElementById("result-subtitle");
  const resultBody = document.getElementById("result-body");
  const resultRequires = document.getElementById("result-requires");

  const firstNameInput = document.getElementById("lead-first-name");
  const emailInput = document.getElementById("lead-email");
  const websiteInput = document.getElementById("lead-website");
  const resultRequiresEl = document.getElementById("result-requires");
  const questionsSection = document.querySelector(".assessment-questions-section");

  let resultNoteEl = null;

  function setResultNote(message, isError) {
    if (!resultNoteEl) {
      resultNoteEl = document.createElement("p");
      resultNoteEl.className = "assessment-result-note";
      resultNoteEl.setAttribute("role", "status");
      if (resultRequiresEl && resultRequiresEl.parentNode) {
        resultRequiresEl.parentNode.insertBefore(
          resultNoteEl,
          resultRequiresEl.nextSibling
        );
      }
    }
    resultNoteEl.textContent = message;
    resultNoteEl.classList.toggle("assessment-result-note--error", !!isError);
    resultNoteEl.classList.toggle("is-visible", !!message);
  }

  function submitToBackend(resultStage, scores) {
    if (!window.DebraApi || typeof window.DebraApi.postJson !== "function") {
      return;
    }

    const answers = questions.map(function (question) {
      return {
        question_id: question.id,
        question_group: question.group,
        value: state.answersById[question.id] || 0
      };
    });

    const payload = {
      name: state.user.first_name,
      email: state.user.email,
      answers: answers,
      scores: scores,
      result_stage: resultStage,
      website: websiteInput ? websiteInput.value.trim() : "",
      source: "assessment",
      page: window.location.pathname
    };

    setResultNote("Sending your result summary by email...", false);

    window.DebraApi.postJson("/assessment", payload)
      .then(function () {
        setResultNote(
          "A copy of your result has been emailed to " + state.user.email + ".",
          false
        );
      })
      .catch(function () {
        // The on-screen result must survive even when the API is unavailable.
        setResultNote(
          "Your result is ready. We could not send the email summary right now, " +
            "but you can still review your result on this page.",
          true
        );
      });
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function getScrollOffset() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--site-header-height");
    const headerHeight = parseInt(raw, 10);
    return Number.isFinite(headerHeight) ? headerHeight : 72;
  }

  function scrollPanelIntoView(panel) {
    if (!panel) return;
    const offset = getScrollOffset() + 16;
    const top = panel.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: prefersReducedMotion() ? "auto" : "smooth"
    });
  }

  function playPanelEntrance(panel) {
    if (!panel || prefersReducedMotion()) return;
    panel.classList.remove("is-panel-entering");
    void panel.offsetWidth;
    panel.classList.add("is-panel-entering");
    panel.addEventListener("animationend", function onEnd(event) {
      if (event.target !== panel) return;
      panel.classList.remove("is-panel-entering");
      panel.removeEventListener("animationend", onEnd);
    });
  }

  function playSectionRevealCue() {
    if (!questionsSection || prefersReducedMotion()) return;
    questionsSection.classList.remove("is-panel-revealed");
    void questionsSection.offsetWidth;
    questionsSection.classList.add("is-panel-revealed");
    questionsSection.addEventListener("animationend", function onEnd(event) {
      if (event.target !== questionsSection) return;
      questionsSection.classList.remove("is-panel-revealed");
      questionsSection.removeEventListener("animationend", onEnd);
    });
  }

  function revealQuestionsPanel() {
    requestAnimationFrame(function () {
      scrollPanelIntoView(panelQuestions);
      playPanelEntrance(panelQuestions);
      playSectionRevealCue();
    });
  }

  function showPanel(panelName) {
    const wasQuestionsHidden = panelQuestions.hidden;
    state.screen = panelName;
    if (panelIntro) {
      panelIntro.hidden = panelName !== "intro";
    }
    panelQuestions.hidden = panelName !== "questions";
    panelLead.hidden = panelName !== "lead";
    panelPaywall.hidden = panelName !== "paywall";
    panelResults.hidden = panelName !== "results";

    if (panelName === "questions" && wasQuestionsHidden) {
      revealQuestionsPanel();
    }
  }

  function selectedValueForCurrent() {
    const questionId = questions[state.currentQuestionIndex].id;
    return state.answersById[questionId];
  }

  function renderOptions(question) {
    questionOptions.innerHTML = "";
    const selectedValue = selectedValueForCurrent();

    answerScale.forEach(function (option) {
      const label = document.createElement("label");
      label.className = "assessment-option";
      if (selectedValue === option.value) {
        label.classList.add("is-selected");
      }

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "assessment-answer";
      input.value = String(option.value);
      input.checked = selectedValue === option.value;
      input.addEventListener("change", function () {
        state.answersById[question.id] = Number(option.value);
        renderQuestion();
      });

      const text = document.createElement("span");
      text.textContent = option.label;

      label.appendChild(input);
      label.appendChild(text);
      questionOptions.appendChild(label);
    });
  }

  function renderQuestion() {
    const current = questions[state.currentQuestionIndex];
    const questionNo = state.currentQuestionIndex + 1;
    const pct = (questionNo / questions.length) * 100;
    const hasSelection = typeof selectedValueForCurrent() === "number";

    progressText.textContent = "Question " + questionNo + " of " + questions.length;
    progressBar.style.width = pct + "%";
    questionGroup.textContent = current.group;
    questionText.textContent = current.text;
    questionBack.disabled = state.currentQuestionIndex === 0;
    questionNext.disabled = !hasSelection;
    questionNext.textContent = questionNo === questions.length ? "Continue" : "Next";

    renderOptions(current);
  }

  function setFormError(input, isError) {
    const group = input.closest(".form-group");
    if (!group) return;
    if (isError) {
      group.classList.add("has-error");
    } else {
      group.classList.remove("has-error");
    }
  }

  function validateLeadForm() {
    const firstName = firstNameInput.value.trim();
    const email = emailInput.value.trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    setFormError(firstNameInput, !firstName);
    setFormError(emailInput, !email || !emailValid);

    if (!firstName) {
      firstNameInput.focus();
      return false;
    }
    if (!email || !emailValid) {
      emailInput.focus();
      return false;
    }

    state.user.first_name = firstName;
    state.user.email = email;
    return true;
  }

  function scoreGroups() {
    const scores = {
      "Strategic Disquiet": 0,
      "Identity Shift": 0,
      "Vision & Architecture": 0,
      "Decisive Expansion": 0,
      "Aligned Leadership™": 0
    };

    questions.forEach(function (question) {
      const val = state.answersById[question.id] || 0;
      scores[question.group] += val;
    });

    return scores;
  }

  function resolveResultStage(scores) {
    let best = tieBreakPriority[0];
    tieBreakPriority.forEach(function (stage) {
      if (scores[stage] > scores[best]) {
        best = stage;
      }
    });
    return best;
  }

  function buildSubmission(resultStage, scores) {
    const answers = questions.map(function (question) {
      return {
        question_id: question.id,
        question_group: question.group,
        value: state.answersById[question.id] || 0
      };
    });

    const crmTag = applyCRMTag(resultStage);

    const submission = {
      user: {
        first_name: state.user.first_name,
        email: state.user.email
      },
      answers: answers,
      scores: scores,
      result_stage: resultStage,
      crm_tag: crmTag,
      is_unlocked: state.isUnlocked,
      created_at: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(submission));
    localStorage.setItem(UNLOCK_KEY, state.isUnlocked ? "true" : "false");

    return submission;
  }

  function renderResults() {
    const scores = scoreGroups();
    const resultStage = resolveResultStage(scores);
    const content = resultsByStage[resultStage];

    resultTitle.textContent = content.headline;
    resultSubtitle.textContent = content.subheadline;
    resultBody.textContent = content.body;
    resultRequires.textContent = "What this stage requires: " + content.requires;

    buildSubmission(resultStage, scores);

    showPanel("results");
    submitToBackend(resultStage, scores);
  }

  function goToQuestion(index) {
    if (index < 0) return;
    if (index >= questions.length) {
      showPanel("lead");
      return;
    }
    state.currentQuestionIndex = index;
    showPanel("questions");
    renderQuestion();
  }

  startBtn.addEventListener("click", function () {
    goToQuestion(0);
  });

  questionBack.addEventListener("click", function () {
    goToQuestion(state.currentQuestionIndex - 1);
  });

  questionNext.addEventListener("click", function () {
    if (questionNext.disabled) return;
    goToQuestion(state.currentQuestionIndex + 1);
  });

  leadBack.addEventListener("click", function () {
    goToQuestion(questions.length - 1);
  });

  leadForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!validateLeadForm()) return;
    showPanel("paywall");
  });

  paywallBack.addEventListener("click", function () {
    showPanel("lead");
  });

  unlockBtn.addEventListener("click", function () {
    state.isUnlocked = true;
    localStorage.setItem(UNLOCK_KEY, "true");
    renderResults();
  });

  showPanel("intro");
})();
