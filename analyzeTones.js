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
require('dotenv').config({ silent: true });
const fs = require('fs');
const csv = require('csvtojson');
const ToneAnalyzerV3 = require('watson-developer-cloud/tone-analyzer/v3');
const toneAnalyzer = new ToneAnalyzerV3({
  username: process.env.MY_TONE_ANALYZER_USERNAME,
  password: process.env.MY_TONE_ANALYZER_PASSWORD,
  version_date: '2016-05-19',
});
const sync = require('synchronize');
const fileName = 'public/data/input_sample.csv';
const data = [];

csv()
.fromFile(fileName)
.on('json', (jsonObj) => {
  data.push(jsonObj);
})
.on('done', () => {
  let conversation = {};
  conversation.text = '';
  let id = 1;
  sync.fiber(() => {
    for (let i = 0; i < data.length; i += 1) {
      const utterance = data[i];
      const utteranceID = utterance.utterance_id;
      const text = utterance.text;
      if (utterance.speaker_type === 'agent') {
        conversation.agent_name = utterance.speaker_type;
      } else {
        conversation.customer_name = utterance.speaker_type;
      }
      conversation.text += `${text}\n`;

      const formattedUtterance = {};
      formattedUtterance.speaker = utterance.speaker_type;

      const params = { utterances: [{ text: `${text}` }] };
      const response = sync.await(toneAnalyzer.tone_chat(params, sync.defer()));
      const tones = response.utterances_tone[0].tones;
      const formattedTones = {};

      if (tones.length > 0) {
        for (let j = 0; j < tones.length; j += 1) {
          const t = tones[j];
          formattedTones[t.tone_name] = +t.score;
        }
      }

      formattedUtterance.tones = formattedTones;
      conversation[`Turn${utteranceID}`] = formattedUtterance;

      if (i === data.length - 1) { // last row
        conversation.length = utteranceID;
        conversation.data_type = 'conversation';
        conversation.conversation_id = utterance.conversation_id;
        fs.writeFileSync(`public/data/conversations/${id}.json`, JSON.stringify(conversation));
      } else if (data[i + 1].utterance_id === '1') { // last utterance of one conversation
        conversation.length = utteranceID;
        conversation.data_type = 'conversation';
        conversation.conversation_id = utterance.conversation_id;
        fs.writeFileSync(`public/data/conversations/${id}.json`, JSON.stringify(conversation));
        conversation = {};
        conversation.text = '';
        id += 1;
      }
    }
  });
});
