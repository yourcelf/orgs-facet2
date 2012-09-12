// vim: set ts=2 sw=2 :
var questions = null;
var data = null;
var geocodes = null;
var constraints = {};
var counts = {};
var totalResponseCount = 0;
$.ajax({
  url: '../questions.json',
  type: 'GET',
  success: function(res) {
    questions = res;
    if (questions && data && geocodes) {
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
  url: '../answers.json',
  type: 'GET',
  success: function(res) {
    data = res;
    if (questions && data && geocodes) {
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
  url: '../geocodes.json',
  type: 'GET',
  success: function(res) {
    geocodes = res;
    if (questions && data && geocodes) {
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

function choiceId(q_index, subq_index, answer_index) {
  return "a" + q_index + "_" + subq_index + "_" + answer_index;
}
function renderChoice(choice, q_index, subq_index, answer_index) {
  var el = $("<span class='choice'></span>");
  var choiceDisp = choice.replace(/\u0092/g, "'");

  var chosen = constraints[q_index] != null && constraints[q_index][subq_index] === answer_index;
  var count = counts[q_index][subq_index][answer_index];

  el.attr({
    id: choiceId(q_index, subq_index, answer_index),
    "data-title": parseInt(100 * count / totalResponseCount) + "% of matched responses",
    "data-placement": "bottom"
  });
  el.tooltip();

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
      dest.append(" ");
    } else {
      // Only show subq labels if there's more than one subq.
      if (question.subquestions.length > 1) {
        dest.append(renderInlineCategory(subq_label));
        dest.append(" ");
      }
      for (j = 0; j < subq_choices.length; j++) {
        dest.append(renderChoice(subq_choices[j], question.index, i, j));
        dest.append(" ");
      }
    }
  }
}
function renderMatrix(question, dest) {
  renderChoiceList(question, dest);
}
function renderGeo(question, dest) {
  // HACK: only using first subquestion.  Get counts by value.
  renderChoiceList(question, dest);
  /*
  var geocounts = {};
  var chart_id = "q" + question.index + "_chart";
  for (var i = 0; i < question.subquestions[0].choices.length; i++) {
    geocounts[ question.subquestions[0].choices[i] ] = {
      'count': counts[question.index][0][i],
      'indexes': [question.index, 0, i]
    }
  }

  var container = $("<div/>");
  var iframe = $("<iframe style='border: none;' src='static/img/Blank_US_Map.svg' width='960px' height='600px' id='" + chart_id + "'></iframe>");
  container.append(iframe);
  dest.append(container);
  var map = document.getElementById(chart_id).contentWindow.document;

  var state_data = {};
  var non_state_data = {};
  for (var term in geocounts) {
    if (geocodes[term] && geocodes[term].state) {
      state_data[term] = geocounts[term];
      state_data[term].state = geocodes[term].state;
    } else {
      non_state_data[term] = geocounts[term];
    }
  }
  var max = 0;
  var min = 0;
  for (var term in state_data) {
    if (state_data[term].count > max) {
      max = state_data[term].count;
    }
  }
  console.log(min, max, state_data);
  function colorize(val) {
    var scale = parseInt(Math.floor((val - min) / (max - min) * 200 + 50));
    return "rgb(0, " + scale + ", 0)";
  }

  for (var term in state_data) {
    (function(term) {
      var state = state_data[term].state;
      var count = state_data[term].count;
      $("#" + state + ", #" + state + " path", map).css(
        "fill", colorize(count)
      );
    })(term);
  }
  */
}
function renderBarChart(question, dest) {
  var values = [];
  var labels = [];
  var indexes= [];
  var valLabelIndex = [];
  if (question.subquestions.length == 1) {
    for (var i = 0; i < question.subquestions[0].choices.length; i++) {
      valLabelIndex.push([
        counts[question.index][0][i], // value
        question.subquestions[0].choices[i], // label
        [question.index, 0, i] // indexes
      ]);
    }
  } else {
    for (var i = 0; i < question.subquestions.length; i++) {
      for (var j = 0; j < question.subquestions[i].choices.length; j++) {
        var label;
        if (question.subquestions[i].choices[j] === "Yes") {
          label = question.subquestions[i].label;
        } else {
          label = question.subquestions[i].choices[j];
        }
        valLabelIndex.push([
          counts[question.index][i][j], // value
          label,
          [question.index, i, j] // indexes
        ]);
      }
    }
  }
  valLabelIndex.sort(function(a, b) {
    // Sort by label: second argument.
    if (a[1] < b[1]) { 
      return -1;
    } else if (a[1] > b[1]) {
      return 1;
    }
    return 0;
  });
  var chart = $("<div class='barchart'></div>");
  for (var i = 0; i < valLabelIndex.length; i++) {
    var value = valLabelIndex[i][0];
    var label = valLabelIndex[i][1];
    var indexes = valLabelIndex[i][2];
    var barHolder = $("<div class='bar-holder'></div>");
    var bar = $("<div class='bar'></div>");
    var barLabel = $("<div class='bar-label'></div>");
    bar.css("width", ((value / totalResponseCount) * 100) + "%");
    barLabel.append(renderChoice(label, indexes[0], indexes[1], indexes[2]));
    barHolder.append(bar);
    barHolder.append(barLabel);
    chart.append(barHolder);
  }
  dest.append(chart);
}
function renderPie(question, dest) {
  for (var i = 0; i < question.subquestions.length; i++) {
    if (constraints[question.index] != null && constraints[question.index][i] != null) {
      return renderChoiceList(question, dest);
    }
  }
  for (var i = 0; i < question.subquestions.length; i++) {
    (function(subq_index) {
      var id = "q" + question.index + "_" + subq_index + "_plot";
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
  setTimeout(function() {
    var el = document.getElementById(choiceId(q_index, subq_index, value));
    if (el) {
      el.scrollIntoView();
    } else {
      el = document.getElementById("q" + q_index);
      if (el) {
        el.scrollIntoView();
      }
    }
  }, 100);

}
function clearConstraint(q_index, subq_index) {
  delete constraints[q_index][subq_index];
  render();
}
function render() {
  // Update counts
  $(".tooltip").remove();
  $("#total .count").html("<img src='static/img/spinner.gif' alt='loading' />");
  setTimeout(_render, 1);
}
function _render() {
  totalResponseCount = 0;
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
      totalResponseCount += 1;
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
  $("#total .count").html(totalResponseCount);
  $("#questions").html("");
  for (var i = 0; i < questions.length; i++) {
    var question = questions[i];
    var qdiv = $("<div class='question'></div>");
    qdiv.append("<h2 id='q" + question.index + "'>" + question.question + "</h2>");
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
