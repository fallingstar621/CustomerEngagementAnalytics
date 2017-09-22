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

/* global d3 $ addTag queryDispatch*/
/* eslint no-param-reassign: ["error", { "props": false }]*/

function StackedBarChart() {
  // default margig, width, and height
  const margin = { top: 100, right: 20, bottom: 10, left: 150 };
  const width = 1100 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  let svgContainer;
  let categories;
  let colorMap;
  let id;
  let introText;
  let inputDomain;

  function showToolTip(tip, content) {
    tip.transition()
        .duration(200)
        .style('opacity', 0.9);
    tip.html(content)
    .style('left', `${d3.event.pageX + 15}px`)
    .style('top', `${d3.event.pageY}px`);
  }

  function hideToolTip(tip) {
    tip.transition()
        .duration(500)
        .style('opacity', 0);
  }

  function stackedBarChart(selection) {
    selection.each(function (data) {
      const y = d3.scale.ordinal()
             .rangeRoundBands([0, height], 0.3);

      const x = d3.scale.linear()
          .rangeRound([0, width]);

      const color = d3.scale.ordinal()
          .range(colorMap);

      const xAxis = d3.svg.axis()
          .scale(x)
          .orient('top');

      const yAxis = d3.svg.axis()
          .scale(y)
          .orient('left');

      let currentSelection;

      svgContainer = d3.select(this).append('g')
            .attr('transform', `translate(${margin.left},${
                         margin.top})`);

      // initiialize tooltip
      const toolTip = d3.select('body').append('div')
          .attr('class', 'barTooltip');

      color.domain(categories);

      const f = d3.format('.1%');

      data.forEach((d) => {
        let x0 = 0;
        d.boxes = color.domain().map((name) => {
          const myObj = { // Create and initialize the variable that will be returned
            name,
            x0,
            x1: x0 += +d[name],
            N: +d.total,
            percentage: f(d[name] / d.total),
            entity: d.entity,
            id: id + d.entity + name,
          };
          return myObj;
        });
      });

      x.domain(inputDomain).nice();
      y.domain(data.map(d => d.entity));

      svgContainer.append('g')
          .append('text')
          .attr('x', 0)
          .attr('y', 20 - margin.top)
          .attr('dy', '.75em')
          .text(introText);

      svgContainer.append('g')
          .attr('class', 'x axis')
          .call(xAxis)
          .append('text')
          .attr('text-anchor', 'end')
          .attr('x', width)
          .attr('y', -40)
          .attr('dy', '.75em')
          .style('font', '12px sans-serif')
          .text('Number of Conversations');

      svgContainer.append('g')
          .attr('class', 'y axis')
          .call(yAxis);

      const vakken = svgContainer.selectAll('.entity')
          .data(data)
          .enter().append('g')
          .attr('class', 'bar')
          .attr('transform', d => `translate(0,${y(d.entity)})`);

      const bars = vakken.selectAll('rect')
          .data(d => d.boxes)
          .enter().append('g')
          .attr('class', 'subbar');

      bars.append('rect')
          .attr('height', y.rangeBand())
          .attr('class', 'section')
          .attr('x', d => x(d.x0))
          .attr('width', d => x(d.x1) - x(d.x0))
          .style('fill', d => color(d.name))
          .on('mouseover', function (d) {
            const focus = d3.select(this);
            focus.style('stroke-width', 1)
                  .style('stroke', 'black')
                  .style('cursor', 'pointer')
                  .style('opacity', 1);

            const context = bars.selectAll('rect').filter(e => d.id !== e.id && e.id !== currentSelection);
            context.style('opacity', 0.5);

            showToolTip(toolTip, `percentage: ${d.percentage}`);
          })
          .on('mouseout', () => {
            bars.selectAll('rect').filter(e => e.id !== currentSelection)
             .style('stroke-width', 0)
             .style('cursor', 'default')
             .style('opacity', 1);
            hideToolTip(toolTip);
          })
          .on('click', function (d) {
            currentSelection = d.id;
            d3.select(this).style('stroke-width', 3);
            bars.selectAll('rect').filter(e => e.id !== currentSelection)
             .style('stroke-width', 0)
             .style('opacity', 1);

            queryDispatch(id, d);

            $('#tag-info').html('Filters Applied: ');
            $('#filterReset').html('Reset Filters');

            addTag('#tag-info', d.name);
            addTag('#tag-info', d.entity);

            d3.event.stopPropagation();
          });


      vakken.insert('rect', ':first-child')
          .attr('height', y.rangeBand())
          .attr('x', '1')
          .attr('width', width)
          .attr('fill-opacity', '0.5')
          .style('fill', '#F5F5F5')
          .attr('class', (d, index) => (index % 2 === 0 ? 'even' : 'uneven'));

      svgContainer.append('g')
          .attr('class', 'y axis')
      .append('line')
          .attr('x1', x(0))
          .attr('x2', x(0))
          .attr('y2', height);

      const startp = svgContainer.append('g').attr('class', 'legendbox').attr('id', 'mylegendbox');
      const legendTabs = [];
      for (let i = 0; i < colorMap.length; i += 1) {
        legendTabs.push(i * 80);
      }
      const legend = startp.selectAll('.legend')
          .data(color.domain().slice())
        .enter().append('g')
          .attr('class', 'legend')
          .attr('transform', (d, i) => `translate(${legendTabs[i]},-45)`);

      legend.append('rect')
          .attr('x', 0)
          .attr('width', 18)
          .attr('height', 18)
          .style('fill', color);

      legend.append('text')
          .attr('x', 22)
          .attr('y', 9)
          .attr('dy', '.35em')
          .style('text-anchor', 'begin')
          .style('font', '12px sans-serif')
          .text(d => d);

      d3.selectAll('.axis path')
          .style('fill', 'none')
          .style('stroke', '#000')
          .style('shape-rendering', 'crispEdges');

      d3.selectAll('.axis line')
          .style('fill', 'none')
          .style('stroke', '#000')
          .style('shape-rendering', 'crispEdges');

      d3.select('.tooltip').transition()
            .duration(200)
            .style('opacity', 0.9)
        .style('left', `${300}px`)
        .style('top', `${300}px`);
    });
  }

  stackedBarChart.categories = function (_) {
    if (!arguments.length) return categories;
    categories = _;
    return stackedBarChart;
  };

  stackedBarChart.colorMap = function (_) {
    if (!arguments.length) return colorMap;
    colorMap = _;
    return stackedBarChart;
  };

  stackedBarChart.id = function (_) {
    if (!arguments.length) return id;
    id = _;
    return stackedBarChart;
  };

  stackedBarChart.introText = function (_) {
    if (!arguments.length) return introText;
    introText = _;
    return stackedBarChart;
  };

  stackedBarChart.inputDomain = function (_) {
    if (!arguments.length) return inputDomain;
    inputDomain = _;
    return stackedBarChart;
  };

  return stackedBarChart;
}

// module.export = StackedBarChart;
