// vim: set ts=2 sw=2 :
var questions = null;
var data = null;
var constraints = {};
var counts = {};
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

function renderChoice(choice, q_index, subq_index, answer_index) {
  var el = $("<span class='choice'></span>");
  var choiceDisp = choice.replace(/\u0092/g, "'");

  var chosen = constraints[q_index] != null && constraints[q_index][subq_index] === answer_index;
  var count = counts[q_index][subq_index][answer_index];

  el.append(
    $("<a href='#' class='" + (chosen ? 'chosen' : '') + "'>" + (choiceDisp || "(blank)") + "</a>").click(function() {
    if (chosen) {
      clearConstraint(q_index, subq_index);
    } else {
      setConstraint(q_index, subq_index, answer_index);
    }
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
  var subq_label, subq_choices, i, j;
  for (i = 0; i < question.subquestions.length; i++) {
    subq_label = question.subquestions[i].label;
    subq_choices = question.subquestions[i].choices;
    if (subq_choices.length === 1 && subq_choices[0] === "Yes") {
      // If the subq's choices are only "Yes", regard the subq label as the
      // 'choice' rather than as a subq.
      dest.append(renderChoice(subq_label, question.index, i, 0));
    } else {
      // Only show subq labels if there's more than one subq.
      if (question.subquestions.length > 1) {
        dest.append(renderInlineCategory(subq_label));
      }
      for (j = 0; j < subq_choices.length; j++) {
        dest.append(renderChoice(subq_choices[j], question.index, i, j));
      }
    }
  }
}
function renderMatrix(question, dest) {
  renderChoiceList(question, dest);
}
function renderGeo(question, dest) {
  renderChoiceList(question, dest);
}
function renderBarChart(question, dest) {
  var values = [];
  var labels = [];
  var indexes= [];
  if (question.subquestions.length == 1) {
    for (var i = 0; i < question.subquestions[0].choices.length; i++) {
      labels.push(question.subquestions[0].choices[i]);
      values.push(counts[question.index][0][i]);
      indexes.push([question.index, 0, i]);
    }
  } else {
    for (var i = 0; i < question.subquestions.length; i++) {
      for (var j = 0; j < question.subquestions[i].choices.length; j++) {
        values.push(counts[question.index][i][j]);
        indexes.push([question.index, i, j])
        if (question.subquestions[i].choices[j] === "Yes") {
          labels.push(question.subquestions[i].label);
        } else {
          labels.push(question.subquestions[i].choices[j]);
        }
      }
    }
  }
  var id = "q" + question.index;
  var container = $("<div>").attr("id", id);
  dest.append(container);
  var r = Raphael(id);
  var bar = r.hbarchart(100, 50, 300, 220, values);
  bar.label([labels]);
//  bar.hover(function() {
//    this.flag = r.popup(this.bar.x, this.bar.y, this.bar.value || "0").insertBefore(this);
//  }, function() {
//    this.flag.remove();
//  });
}
function renderPie(question, dest) {
  for (var i = 0; i < question.subquestions.length; i++) {
    if (constraints[question.index] != null && constraints[question.index][i] != null) {
      return renderChoiceList(question, dest);
    }
  }
  for (var i = 0; i < question.subquestions.length; i++) {
    (function(subq_index) {
      var id = "q" + question.index + "_" + subq_index;
      var container = $("<div style='max-height: 264px;'>").attr("id", id);
      var values = [];
      var labels = []
      for (var j = 0; j < question.subquestions[subq_index].choices.length; j++) {
        var val = counts[question.index][subq_index][j]
        values.push(val);
        labels.push(question.subquestions[subq_index].choices[j] + " (" + val + ")");
      }
      dest.append(container);
      var r = Raphael(id);
      var pie = r.piechart(
        134, 134, 120, values, {
          legend: labels,
          legendpos: "east"
        }
      );
      pie.hover(function() {
        this.sector.stop();
        this.sector.scale(1.1, 1.1, this.cs, this.cy);
        if (this.label) {
          this.label[0].stop();
          this.label[0].attr({ r: 7.5 });
          this.label[1].attr({ "font-weight": 800 });
        }
      }, function() {
        this.sector.animate({ transform: 's1 1 ' + this.cs + ' ' + this.cy }, 500, "bounce");
        if (this.label) {
          this.label[0].animate({ r: 5 }, 500, "bounce");
          this.label[1].attr({ "font-weight": 400 });
        }
      });
      pie.click(function() {
        setConstraint(question.index, subq_index, this.value.order);
      });
    })(i);
  }
}
function checkConstraints(data_row) {
  var q_index, subq_index;
  for (q_index in constraints) {
    for (subq_index in constraints[q_index]) {
      if (data_row[q_index][subq_index] !== constraints[q_index][subq_index]) {
        return false;
      }
    }
  }
  return true;
}
function setConstraint(q_index, subq_index, value) {
  if (constraints[q_index] == null) {
    constraints[q_index] = {};
  }
  constraints[q_index][subq_index] = value;
  render();
}
function clearConstraint(q_index, subq_index) {
  delete constraints[q_index][subq_index];
  render();
}
function render() {
  // Update counts
  var total = 0;
  // build scaffold
  counts = {};
  for (var i=0; i < questions.length; i++) {
    // Question...
    counts[i] = {};
    for (var j=0; j < questions[i].subquestions.length; j++) {
      // Subquestion...
      counts[i][j] = {}
      for (var k = 0; k < questions[i].subquestions[j].choices.length; k++) {
        // Choice.
        counts[i][j][k] = 0;
      }
    }
  }
  // count given constraints.
  for (var r = 0; r < data.length; r++) {
    var row = data[r];
    if (checkConstraints(row)) {
      total += 1;
      for (var q=0; q < row.length; q++) {
        var question = row[q];
        for (var s=0; s < question.length; s++) {
          var subquestion_answer = question[s];
          if (subquestion_answer !== -1) {
            counts[q][s][subquestion_answer] += 1;
          }
        }
      }
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
    qdiv.append(adiv);
    $("#questions").append(qdiv);

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
  }

  // Render constraints
  $("#constraints").html("");
  var constraintsFound = false;
  for (var q in constraints) {
    var qVisited = false;
    for (var subq in constraints[q]) {
      if (!constraintsFound) {
        constraintsFound = true;
        $("#constraints").append("<b>Constraints</b><br/>")
      }
      (function(q, subq) {
        var cdiv = $("<div class='constraint'></div>");
        var cdiv_contents;
        if (!qVisited) {
          cdiv_contents = ["<span class='q'>", questions[q].question, ":<br />"];
          qVisited = true;
        } else {
          cdiv_contents = ["<span class='q'>"];
        }
        if (questions[q].subquestions.length > 1) {

          cdiv_contents.push("<i>");
          cdiv_contents.push(questions[q].subquestions[subq].label);
          cdiv_contents.push(": ");
          cdiv_contents.push("</i>");
        }
        cdiv_contents.push("</span>");
        cdiv.append(cdiv_contents.join(""));

        cdiv.append($("<span class='a'>" +
                      questions[q].subquestions[subq].choices[ constraints[q][subq] ] +
                      "</span>"));
        cdiv.append(
          $("<a href='#'>(remove)</a>").click(function() {
            clearConstraint(q, subq);
            return false;
          })
        );
        $("#constraints").append(cdiv);
      })(q, subq);
    }
  }
}
