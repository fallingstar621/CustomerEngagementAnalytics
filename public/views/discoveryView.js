/**
 * Copyright 2017 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const MAX_QUERY_NUM = 9999;
const margin = { top: 50, right: 20, bottom: 10, left: 100 };
const width = 1100 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// configuration settings for visualizaitons
const toneOrderMap = { frustrated: 3, sad: 2, impolite: 1, neutral: 0, polite: 1, excited: 2, satisfied: 3 };
const chartFields = [['frustrated', 'sad', 'impolite', 'neutral', 'polite', 'excited', 'satisfied'],
                   ['frustrated', 'sad', 'impolite', 'non-negative'],
                   ['frustrated', 'sad', 'impolite', 'neutral', 'polite', 'excited', 'satisfied'],
                   ['frustrated', 'sad', 'impolite', 'neutral', 'polite', 'excited', 'satisfied'],
];

const chartColors = [['#e62325', '#ff806c', '#ffaa9d', '#d8d8d8', '#a8c0f3', '#79a6f6', '#2d74da'],
                   ['#e62325', '#ff806c', '#ffaa9d', '#d8d8d8'],
                   ['#e62325', '#ff806c', '#ffaa9d', '#d8d8d8', '#a8c0f3', '#79a6f6', '#2d74da'],
                   ['#e62325', '#ff806c', '#ffaa9d', '#d8d8d8', '#a8c0f3', '#79a6f6', '#2d74da'],
];

const chartTexts = ["Tone analysis based on customer's first statement in customer care conversations.",
  "Tone analysis based on all of a customer's statements in customer care conversations.",
  "Tone analysis based on customer's last statement in customer care conversations.",
  "Tone analysis based on customer's last statement in customer care conversations."];


const tabOrder = [4, 2, 1, 3];

let rawConversations;
let minUtteranceNum = 2;
const maxUtteranceNum = 9;
let visualizationReady = true;
let showHint = true;
let dataMaps;
let currentSearchString;
let cachedConversations;
let cachedAgents;
let cachedCustomers;  // storing temporal objects for query search results

/* global d3 $ StackedBarChart*/
/* eslint no-param-reassign: ["error", { "props": false }]*/

// core functions

function visualizeDataMaps() {
  let domainMax = 0;

  const formatedData = [];

  for (let chartId = 1; chartId <= 4; chartId += 1) {
    const data = [];
    const jsonObj = dataMaps[chartId];
    const keys = Object.keys(jsonObj);
    for (let k = 0; k < keys.length; k += 1) {
      let total = 0;
      const key = keys[k];
      for (let i = 0; i < Object.keys(jsonObj[key]).length; i += 1) {
        total += jsonObj[key][Object.keys(jsonObj[key])[i]];
      }
      jsonObj[key].total = total;
      jsonObj[key].entity = key;
      data.push(jsonObj[key]);
      domainMax = Math.max(domainMax, total);
    }

    data.sort((a, b) => b.total - a.total);
    formatedData.push(data);
  }

  for (let i = 0; i < 4; i += 1) {
    const chartId = i + 1;
    const chart = new StackedBarChart()
                    .categories(chartFields[i])
                    .colorMap(chartColors[i])
                    .id(chartId)
                    .introText(chartTexts[i])
                    .inputDomain([0, domainMax]);

    const svg = d3.select(`#chart${tabOrder[i]}`).append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);

    svg.datum(formatedData[i]).call(chart);
  }

  $('#loadingSpinner').hide();

  visualizationReady = true;

  if (showHint) {
    d3.select('.section').each(
    function () {
      $(this).popover({ placement: 'bottom',
        title: '<a class="close">×</a>',
        content: '<div>Click on a bar chart section to create a filter</div>',
        html: true,
        container: 'body' });
      $(this).popover('show');
    });

    $(document).on('click', '.popover .close', function () {
      $(this).parents('.popover').popover('hide');
    });
  }

  showHint = false;
}

function retrieveInitialDataMaps() {
  $.post('./retrieveInitialDataMaps', {}, (data) => {
    dataMaps = JSON.parse(data);
    visualizeDataMaps();
  });
}

function updateAgentView(data) {
  let rawTexts = "<div class='label-headers'><h5>Top Agents</h5><span class='frequency-label'>"
    + "Conversations</span> <span class='keyword-label'>Agent Name</span></div>";
  for (let i = 0; i < data.length; i += 1) {
    const key = data[i].key;
    rawTexts += `<span class="frequency">${data[i].matching_results}</span><a class="keyword" onclick="filterConversationByAgent('${key}')">${key}</a>`;
  }
  $('#agentPanel').html(rawTexts);
}

function queryAgent(queryObj) {
  $.post('./queryAgent', queryObj, (data) => {
    const agenetData = JSON.parse(data);
    if (queryObj.cached) {
      cachedAgents = agenetData;
    }
    updateAgentView(agenetData);
  });
}

function updateCustomerView(data) {
  let rawTexts = "<div class='label-headers'><h5>Top Customers</h5><span class='frequency-label'>" +
    "Conversations</span> <span class='keyword-label'>Customer Name</span></div>";
  for (let i = 0; i < data.length; i += 1) {
    const key = data[i].key;
    rawTexts += `<span class="frequency">${data[i].matching_results}</span><a class="keyword" onclick="filterConversationByCustomer('${key}')">${key}</a>`;
  }
  $('#customerPanel').html(rawTexts);
}

function queryCustomer(queryObj) {
  $.post('./queryCustomer', queryObj, (data) => {
    const customerData = JSON.parse(data);
    if (queryObj.cached) {
      cachedCustomers = customerData;
    }
    updateCustomerView(customerData);
  });
}

function displayTexts(rawTexts) {
  $('#pagination').pagination({
    items: rawTexts.length,
    currentPage: 1,
    displayedPages: 3,
    edges: 1,
    cssStyle: '',
    prevText: '<span aria-hidden="true">&laquo;</span>',
    nextText: '<span aria-hidden="true">&raquo;</span>',
    onInit() {
      $('#content').html(rawTexts.length > 0 ? rawTexts[0] : '');
    },
    onPageClick(page) {
      $('#content').html(rawTexts[page - 1]);
    },
  });
}

function updateConversationTexts(threshold) {
  const rawTexts = [];
  for (let i = 0; i < rawConversations.length; i += 1) {
    const N = rawConversations[i].split('</div>').length - 1;
    if (N >= threshold) {
      rawTexts.push(rawConversations[i]);
    }
  }
  $('#conversationHeader').html(`<b>${rawTexts.length} Conversations</b>`);

  displayTexts(rawTexts);
}

function voteUtteranceTone(utterance, isAgent) {
  const tones = utterance.tones;
  const keys = Object.keys(tones).sort((a, b) => toneOrderMap[b] - toneOrderMap[a]);
  if (isAgent) {
    if (keys[0] === 'satisfied') { return keys[1]; }
  } else if (keys[0] === 'sympathetic') { return keys[1]; }

  return keys[0];
}

function updateConversationView(data) {
  rawConversations = [];

  for (let i = 0; i < data.length; i += 1) {
    let text = '';
    const turns = data[i].text.split('\n');
    for (let j = 0; j < data[i].length; j += 1) {
      const turn = data[i][`Turn${j + 1}`];
      const dominate = voteUtteranceTone(turn, turn.speaker === 'agent') || 'neutral';
      let color;
      if (dominate === 'neutral') { // dark the neutral text for visibility
        color = 'grey';
      } else {
        color = chartColors[3][chartFields[3].indexOf(dominate)] || chartColors[0][chartColors[0].length - 1];
      }
      text += `<div class="convo-line"><b style="color:grey;">${
               turn.speaker === 'agent' ? data[i].agent_name : data[i].customer_name
               }<span class="speaker">${turn.speaker}</span></b>`
              + `<b style="color:${color}">${dominate.toUpperCase()}</b> <span>${
               turns[j].length > 500 ? `${turns[j].slice(0, 750)}...` : turns[j]}</span></div>`;
    }
    rawConversations.push(text);
  }

  updateConversationTexts(minUtteranceNum);
}

function queryConversation(queryObj) {
  $.post('./queryConversation', queryObj, (data) => {
    const conversationData = JSON.parse(data);
    if (queryObj.cached) {
      cachedConversations = conversationData;
    }
    updateConversationView(conversationData);

    if (visualizationReady) { $('#loadingSpinner').hide(); }
  });
}

function updateMaps(searchString) {
  visualizationReady = false;

  if (searchString === '') {
    for (let chartId = 1; chartId <= 4; chartId += 1) {
      d3.select(`#chart${chartId}`).selectAll('svg').remove();
    }
    retrieveInitialDataMaps();
    queryAgent({ query: '', cached: true, queryfromCache: true });
    queryCustomer({ query: '', cached: true, queryfromCache: true });
    queryConversation({ query: '', cached: true, queryfromCache: true });
  } else {
    const query = { query: searchString };

    $('#loadingSpinner').show();

    $('.popover').popover('hide');

    let counter = 2;
    let entityMaps = {};
    let agentMap = {};

    $.post('./updateEntityMaps', query, (data) => {
      counter -= 1;
      entityMaps = JSON.parse(data);
      query.cached = true;
      if (counter === 0) {
        dataMaps = entityMaps;
        dataMaps['4'] = agentMap;
        for (let chartId = 1; chartId <= 4; chartId += 1) {
          d3.select(`#chart${chartId}`).selectAll('svg').remove();
        }
        visualizeDataMaps();
      }
    });

    $.post('./updateAgentMap', query, (data) => {
      counter -= 1;
      agentMap = JSON.parse(data);
      if (counter === 0) {
        dataMaps = entityMaps;
        dataMaps['4'] = agentMap;
        for (let chartId = 1; chartId <= 4; chartId += 1) {
          d3.select(`#chart${chartId}`).selectAll('svg').remove();
        }
        visualizeDataMaps();
      }
    });

    queryAgent({ query: searchString, cached: true });
    queryCustomer({ query: searchString, cached: true });
    queryConversation({ query: searchString, count: MAX_QUERY_NUM, cached: true });
  }
}

function queryDispatch(id, d) {
  let conversationQueryObj;
  let metaQueryObj;

  if (!d) {
    updateAgentView(cachedAgents);
    updateCustomerView(cachedCustomers);
    updateConversationView(cachedConversations);
  } else {
    $('#loadingSpinner').show();

    let addon = '';
    if (currentSearchString) {
      addon = `,${currentSearchString}`;
    }

    if (id === 1) {
      if (d) {
        conversationQueryObj = { query: d.entity + addon, count: MAX_QUERY_NUM, number: (d.x1 - d.x0), tone: d.name, id };
        let filterStr = '';
        if (d.name === 'neutral') {
          filterStr = 'Turn1.speaker:customer,Turn1.tones:!frustrated,Turn1.tones:!satisfied';
        } else {
          filterStr = `Turn1.speaker:customer,Turn1.tones.${d.name}>0`;
        }
        metaQueryObj = { query: d.entity + addon, filter: filterStr };
      }
    } else if (id === 2) {
      conversationQueryObj = { query: d.entity + addon, count: MAX_QUERY_NUM, number: (d.x1 - d.x0), tone: d.name, id };
      let filterStr = '';
      for (let i = 0; i < maxUtteranceNum; i += 1) {
        const turn = `Turn${i + 1}`;
        if (d.name === 'non-negative') {
          filterStr += `[${turn}.speaker:customer,${turn}.tones:!frustrated,${turn}.tones:!said,${turn}.tones:!impolite]|`;
        } else { filterStr += `[${turn}.speaker:customer,${turn}.tones.${d.name}>0]|`; }
      }
      metaQueryObj = { query: d.entity + addon, filter: filterStr.slice(0, -1) };
    } else if (id === 3) {
      conversationQueryObj = { query: d.entity + addon, count: MAX_QUERY_NUM, number: (d.x1 - d.x0), tone: d.name, id };
      let filterStr = '';
      for (let i = 0; i < maxUtteranceNum; i += 1) {
        const turn = `Turn${i + 1}`;
        if (d.name === 'neutral') {
          filterStr += `[${turn}.speaker:customer,${turn}.tones:!frustrated,${turn}.tones:!satisfied]|`;
        } else {
          filterStr += `[${turn}.speaker:customer,${turn}.tones.${d.name}>0]|`;
        }
      }
      metaQueryObj = { query: d.entity + addon, filter: filterStr.slice(0, -1) };
    } else if (id === 4) {
      conversationQueryObj = { query: `${addon}`, tone: d.name, count: MAX_QUERY_NUM, number: (d.x1 - d.x0), filter: `agent_name:${d.entity}`, id };
      let filterStr = `agent_name:${d.entity},`;
      for (let i = 0; i < maxUtteranceNum; i += 1) {
        const turn = `Turn${i + 1}`;
        if (d.name === 'neutral') {
          filterStr += `[${turn}.speaker:customer,${turn}.tones:!frustrated,${turn}.tones:!satisfied]|`;
        } else { filterStr += `[${turn}.speaker:customer,${turn}.tones.${d.name}>0]|`; }
      }
      metaQueryObj = { query: d.entity + addon, filter: filterStr.slice(0, -1), aggregation: 'term(agent_name, count:1)' };
    }

    queryAgent(metaQueryObj);
    queryCustomer(metaQueryObj);
    queryConversation(conversationQueryObj);
  }
}

// eslint-disable-next-line no-unused-vars
function clearFilter() {
  $('.tag-cloud').remove();
  $('#tag-info').html('');
  $('#filterReset').html('');
  d3.selectAll('rect')
     .style('stroke-width', 0)
     .style('opacity', 1);
  queryDispatch();
}

// eslint-disable-next-line no-unused-vars
function filterConversationByAgent(key) {
  const rawTexts = [];
  for (let i = 0; i < rawConversations.length; i += 1) {
    if (rawConversations[i].indexOf(key) >= 0) {
      rawTexts.push(rawConversations[i]);
    }
  }
  $('#conversationHeader').html(`<b>${rawTexts.length} Conversations</b>`);
  displayTexts(rawTexts);
}

// eslint-disable-next-line no-unused-vars
function filterConversationByCustomer(key) {
  const rawTexts = [];
  for (let i = 0; i < rawConversations.length; i += 1) {
    if (rawConversations[i].indexOf(key) >= 0) {
      rawTexts.push(rawConversations[i]);
    }
  }
  $('#conversationHeader').html(`<b>${rawTexts.length} Conversations</b>`);
  displayTexts(rawTexts);
}

function initUI() {
  $('#search_input_bottom')
    .on('change', function () {
      if (this.value) {
        currentSearchString = this.value;
        updateMaps(this.value);
        $('#searchBlockTop').css('display', 'block');
        $('#searchBlockBottom').css('display', 'none');
        $('#searchInfoTop').html(`Filtering all conversations by "${this.value}"`);
        $('#search_input_top').val(this.value);

        $('body,html').animate({
          scrollTop: 0,
        }, 1000);
      }
    });

  $('.bx--search-close').on('click', () => {
    currentSearchString = undefined;
    updateMaps('');
    $('#searchInfoTop').html('Filter all conversations by Product, Agent or Customer Name');
  });


  $('#search_input_top')
    .on('change', function () {
      if (this.value) {
        currentSearchString = this.value;
        updateMaps(this.value);
        $('#searchInfoTop').html(`Filtering all conversations by "${this.value}"`);
      }
    })
     .on('keyup', function () {
       if (!this.value) {
         currentSearchString = undefined;
         updateMaps('');
         $('#searchInfoTop').html('Search all conversations by Product, Agent or Customer Name');
       }
     });

   // spinner
  $('#spinner').spinner({
    min: minUtteranceNum,
    max: maxUtteranceNum,
  })
  .on('change', function () {
    minUtteranceNum = this.value;
    updateConversationTexts(this.value);
  });
}

// main logic
retrieveInitialDataMaps();
initUI();
queryAgent({ query: '', cached: true, queryfromCache: true });
queryCustomer({ query: '', cached: true, queryfromCache: true });
queryConversation({ query: '', cached: true, queryfromCache: true });
