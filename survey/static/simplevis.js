// vim: set ts=2 sw=2 :
var questions = null;
var data = null;
var constraints = {};
var oldQueryVal = location.search;
var counts = {};
var totalResponseCount = 0;
var stateCodes = { AL: 1, AK: 1, AZ: 1, AR: 1, CA: 1, CO: 1, CT: 1, DE: 1, of: 1, FL: 1, GA: 1, HI: 1, ID: 1, IL: 1, IN: 1, IA: 1, KS: 1, KY: 1, LA: 1, ME: 1, MD: 1, MA: 1, MI: 1, MN: 1, MS: 1, MO: 1, MT: 1, NE: 1, NV: 1, NH: 1, NJ: 1, NM: 1, NY: 1, NC: 1, ND: 1, OH: 1, OK: 1, OR: 1, PA: 1, RI: 1, SC: 1, SD: 1, TN: 1, TX: 1, UT: 1, VT: 1, VA: 1, WA: 1, WV: 1, WI: 1, WY: 1, AS: 1, GU: 1, MP: 1, PR: 1, VI: 1, FM: 1, MH: 1, PW: 1, AA: 1, AE: 1, AP: 1};

$.ajax({
  url: '../questions.json',
  type: 'GET',
  success: function(res) {
    questions = res;
    if (questions && data) {
      pullState();
      render();
    }
  },
  error: function() {
    if (confirm("Error loading page.  Refresh?")) {
      window.location.reload();
    }
  }
});
$.ajax({
  url: '../answers.json',
  type: 'GET',
  success: function(res) {
    data = res;
    if (questions && data) {
      pullState();
      render();
    }
  },
  error: function() {
    if (confirm("Error loading page.  Refresh?")) {
      window.location.reload();
    }
  }
});

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
    "data-title": (100 * count / totalResponseCount).toFixed(1) + "% of matched responses",
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
  var subq_label, subq_choices, responses, i, j, count, part;
  var sections = [{parts: []}];
  for (i = 0; i < question.subquestions.length; i++) {
    subq_label = question.subquestions[i].label;
    subq_choices = question.subquestions[i].choices;
    var section = sections[sections.length - 1];
    if (subq_choices.length === 1 && subq_choices[0] === "Yes") {
      // If the subq's choices are only "Yes", regard the subq label as the
      // 'choice' rather than as a subq.
      count = counts[question.index][i][0];
      section.parts.push([subq_label, count, question.index, i, 0]);
    } else {
      // Only show subq labels if there's more than one subq.
      if (question.subquestions.length > 1) {
        section.label = subq_label;
        dest.append(" ");
      }
      for (j = 0; j < subq_choices.length; j++) {
        count = counts[question.index][i][j];
        section.parts.push([subq_choices[j], count, question.index, i, j])
      }
      sections.push({parts: []});
    }
  }
  for (i = 0; i < sections.length; i++) {
    sections[i].parts.sort(function(a, b) {
      return a[1] > b[1] ? (-1) : b[1] > a[1] ? 1 : 0;
    });
    if (sections[i].label) {
        dest.append(renderInlineCategory(sections[i].label));
        dest.append(" ");
    }
    for (j = 0; j < sections[i].parts.length; j++) {
      part = sections[i].parts[j];
      dest.append(renderChoice(part[0], part[2], part[3], part[4]));
      dest.append(" ");
    }
  }
}
function renderMatrix(question, dest) {
  renderChoiceList(question, dest);
}
function renderGeo(question, dest) {
  // Assumes the question has *only one subquestion*.

  var chart_id = "q" + question.index + "_chart";
  var container = $("<div/>");
  var iframe = $("<iframe style='border: none;' src='static/img/Blank_US_Map.svg' width='960px' height='600px' id='" + chart_id + "'></iframe>");
  container.append(iframe);
  dest.append(container);
  var state_data = [];
  var non_state_data = [];
  for (var i=0; i < question.subquestions[0].choices.length; i++) {
    var data = {
      label: question.subquestions[0].choices[i],
      count: counts[question.index][0][i],
      indexes: [question.index, 0, i]
    }
    if (stateCodes[data.label] == 1) {
      state_data.push(data);
    } else {
      non_state_data.push(data);
    }
  }
  non_state_data.sort(function(a, b) {
    return a.count > b.count ? (-1) : b.count > a.count ? 1 : 0;
  });

  // Get value range.
  var min = 0;
  var max = 0;
  for (var i = 0; i < state_data.length; i++) {
    if (state_data[i].count > max) {
      if (state_data[i].label != "Not applicable") {
        max = state_data[i].count;
      }
    }
  }
  for (var i = 0; i < non_state_data.length; i++) {
    if (non_state_data[i].count > max) {
      if (non_state_data[i].label != "Not applicable") {
        max = non_state_data[i].count;
      }
    }
  }

  function colorize(val) {
    if (val == 0) {
      return "#D3D3D3";
    }
    var scale = parseInt(Math.floor((val - min) / (max - min) * 200 + 50));
    return "rgb(0, " + scale + ", 0)";
  }

  // Color the states.
  $("#" + chart_id).load(function() {
    var map = document.getElementById(chart_id).contentWindow.document;
    var chartPos = $("#" + chart_id).position();
    for (var i = 0; i < state_data.length; i++) {
      (function(entry) {
        var tooltip = $("<div/>").attr("class", "tooltip fade bottom in").html([
            "<div class='tooltip-inner'>",
              entry.label, ": ", entry.count, " responses (",
              (100 * entry.count / totalResponseCount).toFixed(1),
              "% of matched responses)",
            "</div></div>"
        ].join(""));

        var path = $("#" + entry.label + ", #" + entry.label + " path", map);
        path.css({
          fill: colorize(entry.count),
          cursor: "pointer"
        });
        path.on("mouseover", function(e) {
          $("body").append(tooltip);
          var pos = path[0].getBoundingClientRect();
          tooltip.css({
            display: "block",
            left: (chartPos.left + e.clientX) + "px",
            top: (chartPos.top + e.clientY) + "px"
          });
        });
        path.on("mouseout", function(event) {
          tooltip.remove();
        });
        path.on("click", function(event) {
          setConstraint(entry.indexes[0], entry.indexes[1], entry.indexes[2]);
        });
      })(state_data[i]);
    }
  });
  // Color legend.
  var legend = $("<div/>").css("text-align", "center").html("Legend: ");
  var numSwatches = 5;
  for (var i = 0; i <= numSwatches ; i++) {
    var swatch = $("<span />") 
    var number = parseInt(i * (max - min) / (numSwatches));
    swatch.append(
      $("<span class='swatch'></span>").css("background-color", colorize(number))
    );
    swatch.append(number + " ");
    legend.append(swatch);
  }
  dest.append(legend);
  // Non-state values.
  var nonStateEntries = $("<div/>").append("<h3>Other</h3>");
  for (var term in non_state_data) {
    var entry = non_state_data[term];
    nonStateEntries.append(renderChoice(
      entry.label, entry.indexes[0], entry.indexes[1], entry.indexes[2]
    ));
    nonStateEntries.append(" ");
  }
  dest.append(nonStateEntries);
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
  pushState();
  render();
  setTimeout(function() {
    var el = document.getElementById("q" + questions[q_index].number);
    if (el) {
      el.scrollIntoView();
    }
  }, 100);
}
function clearConstraint(q_index, subq_index) {
  delete constraints[q_index][subq_index];
  pushState();
  render();
}
function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) == variable) {
      return decodeURIComponent(pair[1]);
    }
  }
}
function pushState() {
  var clist = [];
  if (window.history && history.pushState) {
    for (var q_index in constraints) {
      for (var subq in constraints[q_index]) {
        // Use question number (which will never change) rather than question
        // index (which could change if we change which questions are
        // displayed) for the URL.
        clist.push([
          questions[q_index].number, parseInt(subq), constraints[q_index][subq]
        ]);
      }
    }
    // Sort to avoid duplicate URLs.
    clist.sort(function(a, b) {
      if (a[0] > b[0]) {
        return 1;
      } else if (b[0] > a[0]) {
        return -1;
      } else if (a[1] > b[1]) {
        return 1;
      } else if (b[1] > a[1]) {
        return -1;
      } else if (a[2] > b[2]) {
        return 1;
      } else if (b[2] > a[2]) {
        return -1;
      } else {
        return 0;
      }
    });
    if (clist.length > 0) {
      history.pushState(null, null, "?q=" + encodeURIComponent(JSON.stringify(clist)));
    } else {
      history.pushState(null, null, "/");
    }
    oldQueryVal = location.search;
  }
}
function pullState() {
  constraints = {};
  if (location.search && location.search.length > 1) {
    var query = getQueryVariable("q");
    if (query.length == 0) {
      return;
    }
    var clist = JSON.parse(query);
    for (var i = 0; i < clist.length; i++) {
      // convert question number to question index.
      for (var j = 0; j < questions.length; j++) {
        if (questions[j].number == clist[i][0]) {
          var q = questions[j].index;
          if (constraints[q] == null) {
            constraints[q] = {};
          }
          constraints[q][clist[i][1]] = clist[i][2];
          break;
        }
      }
    }
  }
}
window.addEventListener("popstate", function() {
  setTimeout(function() {
    if (oldQueryVal != location.search) {
      pullState();
      oldQueryVal = location.search;
      render();
    }
  }, 1);
});


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
  $("#percentage").html("");
  if (totalResponseCount != data.length) {
    $("#percentage").html((100 * totalResponseCount / data.length).toFixed(1) + "% of all responses match these criteria.");
  }
  $("#questions").html("");
  for (var i = 0; i < questions.length; i++) {
    var question = questions[i];
    var qdiv = $("<div class='question'></div>");
    qdiv.append([
        "<h2 id='q", question.number, "'>", question.question,
        " <a class='anchor' name='q", question.number, "' href='#q", question.number, "'>&para;</a>",
        "</h2>"].join(""));
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
