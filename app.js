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

 /* eslint-env es6 */
 /* eslint no-param-reassign: ["error", { "props": false }]*/

require('dotenv').config({ silent: true });

const express = require('express');
const app = express();
// Bootstrap application settings
require('./config/express')(app);
const watson = require('watson-developer-cloud');

const discovery = watson.discovery({
  // username: process.env.MY_DISCOVERY_USERNAME,
  // password: process.env.MY_DISCOVERY_PASSWORD,
  version: 'v1',
  version_date: '2017-07-19',
});

const MY_ENVIRONMENT_ID = process.env.ENVIRONMENT_ID;
const MY_COLLECTION_ID = process.env.COLLECTION_ID;

const MAX_QUERY_NUM = 9999;
const VISIBLE_NUM = 6;

// pre-processing
const preStopWords = ['BRAND', 'hour', 'year', '10', 'help', 'us', 'minute', '%', 'week', 'fail',
  'day', 'mins', 'twitter', 'https', 'http', 'technical support', 'log file', 'community'];
const chartFields = [['frustrated', 'sad', 'impolite', 'neutral', 'polite', 'excited', 'satisfied'],
                   ['frustrated', 'sad', 'impolite', 'non-negative'],
                   ['frustrated', 'sad', 'impolite', 'neutral', 'polite', 'excited', 'satisfied'],
                   ['frustrated', 'sad', 'impolite', 'neutral', 'polite', 'excited', 'satisfied'],
];

const toneOrderMap = { frustrated: 3, sad: 2, impolite: 1, neutral: 0, polite: 1, excited: 2, satisfied: 3 };

// pre-stored data
const initialEntityMaps = {};
const initialAgentMap = {};
let initialEntityList;
let initialConversations;
let initialAgents;
let initialCustomers;

// core functions

function getDominantTone(tones) {
  const keys = Object.keys(tones).sort((a, b) => toneOrderMap[b] - toneOrderMap[a]);
  if (keys[0] === 'sympathetic') {
    return keys[1] || 'neutral';
  }
  return keys[0] || 'neutral';
}

function getScore(tone) {
  if (tone === 'frustrated') {
    return 3;
  } else if (tone === 'sad') {
    return 2;
  } else if (tone === 'impolite') {
    return 1;
  }
  return 0;
}

function getToneByScore(score) {
  if (score === 3) {
    return 'frustrated';
  } else if (score === 2) {
    return 'sad';
  } else if (score === 1) {
    return 'impolite';
  }
  return 'non-negative';
}

function voteLastUtteranceTone(conversation, config) {
  if (config === 'CUSTOMER') {
    const N = conversation.length;
    for (let i = N; i >= 1; i -= 1) {
      const turn = conversation[`Turn${i}`];
      if (turn.speaker === 'customer') {
        const tones = turn.tones;
        return getDominantTone(tones);
      }
    }
  }
}

function voteConversationTone(conversation, selectedTones, config) {
  const N = conversation.length;
  let highestScore = 0;
  for (let i = N; i >= 1; i -= 1) {
    const turn = conversation[`Turn${i}`];
    if (config === 'CUSTOMER' && turn.speaker === 'customer') {
      const tones = turn.tones;
      for (let t = 0; t < Object.keys(tones).length; t += 1) {
        const score = getScore(Object.keys(tones)[t]);
        if (score > highestScore) {
          highestScore = score;
        }
      }
    }
  }

  return getToneByScore(highestScore);
}

function computeAgentMap(agentMap, queryString, res) {
  const agentQuery = { query: queryString, count: MAX_QUERY_NUM };

  agentQuery.environment_id = MY_ENVIRONMENT_ID;
  agentQuery.collection_id = MY_COLLECTION_ID;
  agentQuery.aggregation = `term(agent_name,count:${VISIBLE_NUM})`;

  discovery.query(agentQuery, (error, data) => {
    if (data) {
      const agentData = data.aggregations[0].results;
      let agentList = '';
      const agents = [];
      for (let i = 0; i < agentData.length; i += 1) {
        agentList += `${agentData[i].key}|`;
        agents.push(agentData[i].key);
      }

      const conversationQuery = { query: queryString, count: MAX_QUERY_NUM, filter: `agent_name:${agentList.slice(0, -1)}` };
      conversationQuery.environment_id = MY_ENVIRONMENT_ID;
      conversationQuery.collection_id = MY_COLLECTION_ID;

      discovery.query(conversationQuery, (error2, data2) => {
        if (data2) {
          const conversationData = data2.results;
          const fields = chartFields[3];
          for (let i = 0; i < agents.length; i += 1) {
            agentMap[agents[i]] = {};
            for (let f = 0; f < fields.length; f += 1) {
              agentMap[agents[i]][fields[f]] = 0;
            }
          }
          for (let i = 0; i < conversationData.length; i += 1) {
            const conversation = conversationData[i];
            const agent = conversation.agent_name;

            if (agent) {
              const dTone = voteLastUtteranceTone(conversation, 'CUSTOMER');
              if (fields.indexOf(dTone) >= 0) {
                agentMap[agent][dTone] += 1;
              }
            }
          }
          console.log('Finished computing agent map');

          if (res) { res.end(JSON.stringify(agentMap)); }
        } else if (res) { res.end(JSON.stringify(agentMap)); }
      });
    } else if (res) { res.end(JSON.stringify(agentMap)); }
  });
}

function mapEntities(chartId, data, entityList, entityMap, entityMaps) {
  if (chartId === 1) {
    for (let i = 0; i < data.length; i += 1) {
      const conversation = data[i];
      if ('enriched_text' in conversation) {
        const entities = conversation.enriched_text.entities;
        const tones = conversation.Turn1.tones;
        const dTone = getDominantTone(tones);
        for (let e = 0; e < entities.length; e += 1) {
          const entity = entities[e].text;
          if (entityList.indexOf(entity) >= 0) {
            entityMap[entity][dTone] += 1;
          }
        }
      }
    }
  } else if (chartId === 2) {
    for (let i = 0; i < data.length; i += 1) {
      const conversation = data[i];
      if ('enriched_text' in conversation) {
        const entities = conversation.enriched_text.entities;
        const dTone = voteConversationTone(conversation, chartFields[chartId], 'CUSTOMER');
        if (dTone !== undefined) {
          for (let e = 0; e < entities.length; e += 1) {
            const entity = entities[e].text;
            if (entityList.indexOf(entity) >= 0) {
              entityMap[entity][dTone] += 1;
            }
          }
        }
      }
    }
  } else if (chartId === 3) {
    for (let i = 0; i < data.length; i += 1) {
      const conversation = data[i];
      if ('enriched_text' in conversation) {
        const entities = conversation.enriched_text.entities;
        const dTone = voteLastUtteranceTone(conversation, 'CUSTOMER');
        for (let e = 0; e < entities.length; e += 1) {
          const entity = entities[e].text;
          if (entityList.indexOf(entity) >= 0) {
            entityMap[entity][dTone] += 1;
          }
        }
      }
    }
  }

  console.log(`Finished computing entity map for chart ${chartId}`);
  entityMaps[chartId] = entityMap;
}

function computeEntityMap(entityMaps, queryString, res) {
  const queryObj = { query: queryString, count: MAX_QUERY_NUM };

  queryObj.environment_id = MY_ENVIRONMENT_ID;
  queryObj.collection_id = MY_COLLECTION_ID;

  discovery.query(queryObj, (error, queryData) => {
    if (queryData) {
      const data = queryData.results;

      const topics = [];

      for (let i = 0; i < data.length; i += 1) {
        const conversation = data[i];
        if ('enriched_text' in conversation) {
          const entities = conversation.enriched_text.entities;
          for (let j = 0; j < entities.length; j += 1) {
            const s = entities[j].text.toLowerCase();
            if (s[0] === '#') {
              entities[j].text = s.slice(1);
            } else {
              entities[j].text = s;
            }
            topics.push(entities[j].text);
          }
        }
      }

      const counts = {};

      for (let i = 0; i < topics.length; i += 1) {
        const key = topics[i];
        let isSignificant = true;
        for (let s = 0; s < preStopWords.length; s += 1) {
          if (key.indexOf(preStopWords[s]) >= 0) {
            isSignificant = false;
            break;
          }
        }

        if (isSignificant) {
          counts[key] = (counts[key] || 0) + 1;
        }
      }

      const fullEntityList = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

      if (queryObj.query === undefined || queryObj.query === '') {
        initialEntityList = fullEntityList;
      }

      const entityList = fullEntityList.slice(0, VISIBLE_NUM);

        // construct entity map
      for (let chartId = 1; chartId <= 3; chartId += 1) {
        const fields = chartFields[chartId - 1];
        const entityMap = {};
        for (let k = 0; k < entityList.length; k += 1) {
          const entity = entityList[k];
          entityMap[entity] = {};
          for (let f = 0; f < fields.length; f += 1) {
            entityMap[entity][fields[f]] = 0;
          }
        }

        mapEntities(chartId, data, entityList, entityMap, entityMaps);
      }

      if (res) {
        entityMaps.fullEntityList = fullEntityList;
        res.end(JSON.stringify(entityMaps));
      }
    }
  });
}

function queryConversation(queryObj, res) {
  queryObj.environment_id = MY_ENVIRONMENT_ID;
  queryObj.collection_id = MY_COLLECTION_ID;

  discovery.query(queryObj, (error, data) => {
    if (data) {
      const results = data.results;

      if (!('id' in queryObj)) {
        if (queryObj.query === undefined || queryObj.query === '') { initialConversations = results; }
        if (res) { res.end(JSON.stringify(results)); }
        return;
      }

      const chartId = +queryObj.id;

      if (chartId === 1) {
        const tone = queryObj.tone;
        const filteredResults = [];
        for (let i = 0; i < results.length; i += 1) {
          const conversation = results[i];
          const tones = conversation.Turn1.tones;
          const dTone = getDominantTone(tones);
          if (tone === dTone) {
            filteredResults.push(conversation);
          }
        }
        res.end(JSON.stringify(filteredResults.slice(0, queryObj.number)));
      } else if (chartId === 2) {
        const tone = queryObj.tone;
        const filteredResults = [];
        const fields = chartFields[chartId - 1];
        for (let i = 0; i < results.length; i += 1) {
          const conversation = results[i];
          if (tone === voteConversationTone(conversation, fields, 'CUSTOMER')) {
            filteredResults.push(conversation);
          }
        }
        res.end(JSON.stringify(filteredResults.slice(0, queryObj.number)));
      } else if (chartId === 3 || chartId === 4) { // check the last customer turn
        const tone = queryObj.tone;
        const filteredResults = [];
        for (let i = 0; i < results.length; i += 1) {
          const conversation = results[i];
          const dTone = voteLastUtteranceTone(conversation, 'CUSTOMER');
          if (tone === dTone) {
            filteredResults.push(conversation);
          }
        }
        res.end(JSON.stringify(filteredResults.slice(0, queryObj.number)));
      }
    }
  });
}

function queryAgent(queryObj, res) {
  queryObj.environment_id = MY_ENVIRONMENT_ID;
  queryObj.collection_id = MY_COLLECTION_ID;
  queryObj.aggregation = queryObj.aggregation || 'term(agent_name, count:5)';

  discovery.query(queryObj, (error, data) => {
    if (data) {
      if (queryObj.query === undefined || queryObj.query === '') {
        initialAgents = data.aggregations[0].results;
      }
      if (res) { res.end(JSON.stringify(data.aggregations[0].results)); }
    }
  });
}

function queryCustomer(queryObj, res) {
  queryObj.environment_id = MY_ENVIRONMENT_ID;
  queryObj.collection_id = MY_COLLECTION_ID;
  queryObj.aggregation = 'term(customer_name, count:5)';

  discovery.query(queryObj, (error, data) => {
    if (data) {
      if (queryObj.query === undefined || queryObj.query === '') {
        initialCustomers = data.aggregations[0].results;
      }
      if (res) { res.end(JSON.stringify(data.aggregations[0].results)); }
    }
  });
}

function preComputeData() {
  computeEntityMap(initialEntityMaps);  // note: keyword computation is done with entity computation
  computeAgentMap(initialAgentMap);
  queryConversation({ query: '', count: MAX_QUERY_NUM });
  queryAgent({ query: '' });
  queryCustomer({ query: '' });
}

// pre-computations when server starts
preComputeData();

// route requests
app.post('/retrieveInitialDataMaps', (req, res) => {
  const dataMaps = JSON.parse(JSON.stringify(initialEntityMaps));
  dataMaps['4'] = JSON.parse(JSON.stringify(initialAgentMap));
  dataMaps.fullEntityList = initialEntityList;
  res.end(JSON.stringify(dataMaps));
});

app.post('/updateEntityMaps', (req, res) => {
  const entityMaps = {};
  const searchString = req.body.query;
  computeEntityMap(entityMaps, searchString, res);
});

app.post('/updateAgentMap', (req, res) => {
  const agentMap = {};
  const searchString = req.body.query;
  computeAgentMap(agentMap, searchString, res);
});

app.post('/queryConversation', (req, res) => {
  if (req.body.queryfromCache) {
    res.end(JSON.stringify(initialConversations));
  } else { queryConversation(req.body, res); }
});

app.post('/queryAgent', (req, res) => {
  if (req.body.queryfromCache) {
    res.end(JSON.stringify(initialAgents));
  } else { queryAgent(req.body, res); }
});

app.post('/queryCustomer', (req, res) => {
  if (req.body.queryfromCache) {
    res.end(JSON.stringify(initialCustomers));
  } else { queryCustomer(req.body, res); }
});

module.exports = app;
