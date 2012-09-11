// vim: set ts=2 sw=2 :
var questions = null;
var data = null;
var constraints = {};
$.ajax({
  url: '/questions.json',
  type: 'GET',
  success: function(res) {
    questions = res;
    if (questions && data) {
      render();
    }
  },
  error: function() {
    if (confirm("Error loading page.  Refresh?")) {
      window.reload();
    }
  }
});
$.ajax({
  url: '/answers.json',
  type: 'GET',
  success: function(res) {
    data = res;
    if (questions && data) {
      render();
    }
  },
  error: function() {
    if (confirm("Error loading page.  Refresh?")) {
      window.reload();
    }
  }
});

function sortCopy(array) {
  var copy = array.slice();
  copy.sort();
  return copy;
}

function renderChoice(choice, count, q_index, subq_index, answer_index) {
  var el = $("<span class='choice'></span>");
  var choiceDisp = choice.replace(/\u0092/g, "'");

  var chosen = constraints[q_index] != null && constraints[q_index][subq_index] === answer_index;

  el.append(
    $("<a href='#' class='" + (chosen ? 'chosen' : '') + "'>" + (choiceDisp || "(blank)") + "</a>").click(function() {
    if (chosen) {
      delete constraints[q_index][subq_index];
    } else {
      if (constraints[q_index] == null) {
        constraints[q_index] = {};
      }
      constraints[q_index][subq_index] = answer_index;
    }
    render();
    return false;
  }).addClass(count == 0 ? 'zero' : '')
  );
  el.append("<span class='count" + (count == 0 ? ' zero' : '') + "'>(" + count + ")</span>");
  el.append(" ");
  return el;
}
function renderInlineCategory(text) {
  return "<span class='inline-category'>" + text + ":</span>&nbsp;";
}

function renderChoiceList(question, dest) {
  // Are we a "+ Other" question?
  var choice, subq, i, j, k;
  if (question.choices.length == 1) {
    // This is a simple question with no subquestion and no "Other".
    for (i = 0; i < question.choices[0][1].length; i++) {
      choice = question.choices[0][1][i];
      dest.append(renderChoice(choice[0], choice[1], question.index, 0, i));
    }
  } else if (question.choices.length > 1) {
    // This is a "choose all that apply" from a constrained list with or
    // without an "Other".
    for (var i = 0; i < question.choices.length ; i++) {
      subq = question.choices[i];
      if (subq[1].length === 1 && subq[1][0][0] === "Yes") {
        dest.append(renderChoice(subq[0], subq[1][0][1], question.index, i, 0));
      } else {
        dest.append(renderInlineCategory(subq[0]));
        for (var j = 0; j < subq[1].length; j++) {
          dest.append(renderChoice(subq[1][j][0], subq[1][j][1], question.index, i, j));
        }
      }
    }
  } else {
    console.error("How to handle this question? Ack!")
    console.log(question);
  }
}
function renderMatrix(question, dest) {
  renderChoiceList(question, dest);
}
function renderGeo(question, dest) {
  renderChoiceList(question, dest);
}
function renderBarChart(question, dest) {
  renderChoiceList(question, dest);
}
function renderPie(question, dest) {
  renderChoiceList(question, dest);
}
function render() {
  // Update counts
  var counts = {};
  var total = 0;
  for (var i=0; i < questions.length; i++) {
    counts[i] = {};
    for (var j=0; j < questions[i].choices.length; j++) {
      counts[i][j] = questions[i].choices[j][1];
    }
  }

  // Render facets
  $("#total .count").html(total);
  $("#questions").html("");
  for (var i = 0; i < questions.length; i++) {
    var question = questions[i];
    var qdiv = $("<div class='question'></div>");
    qdiv.append("<h2>" + question.question + "</h2>");
    var adiv = $("<div class='answers'></div>");

    switch (question.widget) {
      case 'matrix': renderMatrix(question, adiv); break;
      case 'geo': renderGeo(question, adiv); break;
      case 'choice_list': renderChoiceList(question, adiv); break;
      case 'bar_chart': renderBarChart(question, adiv); break;
      case 'pie': renderPie(question, adiv); break;
      default:
        console.error("Unknown widget: " + question.widget);
      console.log(question);
    }

    qdiv.append(adiv);
    $("#questions").append(qdiv);
  }

  // Render constraints
  $("#constraints").html("");
  for (var question in constraints) {
    (function(question) {
      var parts = question.split("::");
      var q = parts[0];
      if (parts.length > 1) {
        var subq = parts[1];
      }
      var cdiv = $("<div class='constraint'></div>");
      if (parts.length > 1) {
        cdiv.append($("<span class='q'>" + questions[q].question + ": " + subq + ": </span>"));
      } else {
        cdiv.append($("<span class='q'>" + questions[q].question + ":</span>"));
      }
      cdiv.append($("<span class='a'>" + constraints[question] + "</span>"))
      cdiv.append(
        $("<a href='#'>(remove)</a>").click(function() {
        delete constraints[question];
        render();
        return false;
      })
      );
      $("#constraints").append(cdiv);
    })(question);
  }
}
