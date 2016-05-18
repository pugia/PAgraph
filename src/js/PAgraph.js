// PAgraph Plugin
(function ($) {

	// graphics
	$.fn.PAgraph = function( options ) {

		// default options
		var settings = $.extend(true, {

			mode: 'history',
			filter: {  // only for history mode
				mode: 'daily',
				labels: ['daily', 'weekly', 'monthly'],
				limits: {
					daily: 28, 
					enable_weekly: 40,
					enable_monthly: 60,
					disable_weekly: 120
				}
			},
			config: {
				graph: [],
				grid: {
					x: {
						show: true,
						color: '#E2E6E9',
						label: '#C1C1C1',
						format: function(v) { return v; }
					},
					y: {
						show: true,
						color: '#C6CED3',
						label: '#C1C1C1',
						format: null
					}
				},
				spacing: 10,
				stacked: false,
				rectRadius: 5
			},
			lineInterpolation: 'cardinal',
			interpolateOnZero: true,
			preFetch: null,

		}, options );

		var graph = this;
		graph.addClass('PAgraphContainer');
				
		var structure = {
			legend: null,
			tooltip: null,
			data: [],
			filters: null,
			svg: {
				element: null,
				grid: {
					group: null,
					x: {
						group: null,
						elements: []
					},
					y: {
						group: null,
						elements: []
					}
				},
				label: {
					x: {
						group: null,
						elements: []
					},
					y: {
						group: null,
						spacing: [],
						elements: []
					}
				},
				graph: {
					group: null,
					elements: [],
					circles: null
				}
			}
		};

		var graphElementsEmpty = {
			group: null,
			elements: {
				line: null,
				area: null,
				points: {
					coords: [],
					elements: []
				}
			}
		};

		var internalSettings = {

			labels: {
				x: {
					height: 30,
					marginTop: 15
				},
				y: {
					width: 60,
					marginLeft: 10
				}
			},
			
			graphAnimationTime: 600,
			animateGridTime: 500,
			animateEasing: 'cubic-in-out',
			graphLineInterpolation: settings.lineInterpolation
		};

		// legend
		structure.legend = d3.selectAll(graph.get()).append('div')
			.classed('PAlegend', true);

		// tooltip
		structure.tooltip = d3.selectAll(graph.get()).append('div')
			.classed('PAtooltip', true);

		structure.tooltip.append('span').classed('time', true).text('');
		structure.tooltip.append('span').classed('metric', true).text('');
		structure.tooltip.append('label').text('');

		// svg
		structure.svg.element = d3.selectAll(graph.get()).append('svg')
			.classed('PAGraph', true)
			.classed('PAMode'+settings.mode.capitalizeFirstLetter(), true)
			.attr('width', graph.width())
			.attr('height', graph.height());
		structure.svg.grid.group = structure.svg.element.append('g').classed('PAGgrid', true);
		structure.svg.label.x.group = structure.svg.element.append('g').classed('PAGlabelX', true);
		structure.svg.label.y.group = structure.svg.element.append('g').classed('PAGlabelY', true);
		structure.svg.graph.group = structure.svg.element.append('g').classed('PAGgraphs', true);
		structure.svg.graph.circles = structure.svg.element.append('g').classed('PAGcircles', true);
				
		var gW = graph.width();
		var gH = graph.height();
		var t = null;
		$(window)
			.on('resize', function() {
				
				clearTimeout(t);
				t = setTimeout(function() {
					if (graph.width() != gW || graph.height() != gH) {

						if (graph.width() != gW) {
							gW = graph.width();
							structure.svg.element.attr('width', graph.width());
						}
						if (graph.height() != gH) {
							gH = graph.height();
							structure.svg.element.attr('height', graph.height());
						}
					
						graph.draw();
					}
				}, 100);
				
			});


		var MODE = {

			history: {

				filter: 'daily', // daily, weekly, monthly
				computedData: [null,null],
				filledEdges: false,

				// start with a week structure
				init: function() {

					debug('MODE: history');

					var self = this;

					self.initLegend();
					self.initCircles();
					self.initFilters();
					self.grid();

				},

				grid: function() {

					var self = this;

					self.initGridX();
					self.initGridY();

				},

				/* INIT */
				// create empty grid without label
				initGridX: function() {

					var self = this;

					var w = graph.width();
					var h = graph.height();
					var j = 0;

					var elementsCount = 8;

					if (settings.config.grid.x.label !== false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label !== false) {  j = internalSettings.labels.y.width; w = w - j; }

					var spacing = w / (elementsCount-1);
					structure.svg.grid.group.selectAll('g.PAGgridX line').remove();
					structure.svg.grid.x.group = structure.svg.grid.group.append('g').classed('PAGgridX', true);

					for (var i = 0; i < elementsCount; i++) {

						var x = (i * spacing)	+ j;

						var line =  structure.svg.grid.x.group.append('line')
							.attr('x1', x).attr('y1', 0)
							.attr('x2', x).attr('y2', h)
							.attr('stroke', settings.config.grid.x.color);
						structure.svg.grid.x.elements.push(line);

					}

				},
				initGridY: function() {
					var self = this;

					var w = graph.width();
					var h = graph.height();
					var j = 0;

					if (settings.config.grid.x.label !== false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label !== false) {  j = internalSettings.labels.y.width; w = w - j; }

					var elementsCount = 6;

					var spacing = Math.floor(h / elementsCount);
					structure.svg.grid.group.selectAll('g.PAGgridY line').remove();
					structure.svg.grid.y.group = structure.svg.grid.group.append('g').classed('PAGgridY', true);


					for (var i = 0; i < elementsCount; i++) {

						var line =  structure.svg.grid.y.group.append('line')
							.attr('x1', j).attr('y1', h - (i*spacing))
							.attr('x2', graph.width()).attr('y2', h - (i*spacing))
							.attr('stroke', settings.config.grid.y.color);
						structure.svg.grid.y.elements.push(line);

					}

				},

				// create flat graph
				initGraph: function(index_wanted, color, legend, format) {

					var self = this;
					var dfrd = $.Deferred();

					if (index_wanted && structure.svg.graph.elements[index_wanted]) {
						dfrd.resolve(index_wanted);
						return dfrd.promise();
					}

					var w = graph.width();
					var h = graph.height();
					var j = 0;

					var graphElements = $.extend(true, {}, graphElementsEmpty);

					graphElements.group = structure.svg.graph.group.insert('g',':first-child')
						.classed('PAGgraph', true);
					structure.svg.graph.elements.push(graphElements);

					var index = structure.svg.graph.elements.length - 1;
					structure.svg.graph.elements[index].group.attr('data-index', index);

					// create settings structure
					color = color || "#"+((1<<24)*Math.random()|0).toString(16);
					legend = legend || 'Graph '+index;
					format = format || null;

					settings.config.graph.push({
						color: color,
						legend: legend,
						format: format
					});
					
					var elementsCount = structure.svg.grid.x.elements.length || 8;
					structure.svg.element.attr('data-points', elementsCount);

					if (settings.config.grid.x.label !== false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label !== false) {  j = internalSettings.labels.y.width; }
					var spacing = w / (elementsCount-1);

					var lineData = [];
					for (var i = 0; i < elementsCount; i++) {
						var x = (i * spacing)	+ j;
						lineData.push({x:x, y:h});
					}

					var lineF = d3.svg.line()
						.x(function(d) { return d.x; })
						.y(function(d) { return d.y; })
						.interpolate(internalSettings.graphLineInterpolation);
					var pathCoord = lineF(lineData);
					var lineG = structure.svg.graph.elements[index].group.append('path')
						.classed('PAGgraphLine', true)
						.attr('d', pathCoord)
						.attr('stroke', settings.config.graph[index].color)
						.attr('stroke-width', 1)
						.attr('fill', 'none');
					structure.svg.graph.elements[index].elements.line = lineG;

					var areaG = structure.svg.graph.elements[index].group.append('path')
						.classed('PAGgraphArea', true)
						.attr('d', pathCoord)
						.attr('stroke-width', 0)
						.attr('fill', settings.config.graph[index].color);
					structure.svg.graph.elements[index].elements.area = areaG;

					// add label to legend
					var p = structure.legend.append('p')
						.attr('data-index', index);
					p.append('span')
						.style('background', settings.config.graph[index].color);
					p.append('label')
						.text(settings.config.graph[index].legend);

					setTimeout(function() { dfrd.resolve(index); }, elementsCount*25);
					return dfrd.promise();

				},

				// action on legend
				initLegend: function() {

					var self = this;

					graph.find('div.PAlegend')
						.addClass('PAhide')
						.on('click', 'p[data-index]', function() {
							var index = parseInt($(this).attr('data-index'));
							self.moveOnFront(index);
						});
				},

				// create filters menu
				initFilters: function() {

					var self = this;

					structure.filters = d3.selectAll(graph.get()).insert('div',":first-child")
						.classed('PAfilters', true);

					structure.filters.append('p').attr('data-mode', 'daily').text(settings.filter.labels[0]);
					structure.filters.append('p').attr('data-mode', 'weekly').text(settings.filter.labels[1]);
					structure.filters.append('p').attr('data-mode', 'monthly').text(settings.filter.labels[2]);

					graph.find('div.PAfilters')
						.addClass('PAhide')
						.on('click', 'p[data-mode]', function() {

							// control values
							settings.filter.mode = $(this).attr('data-mode');
							self.applyFilter();

						});

				},

				/* ANIMATE */
				setData: function(data, index) {

					var self = this;
					var dfrd = $.Deferred();
					index = index || 0;

					// empty stored data with different scale on index 0
					if (structure.data[0] && structure.data.length && index === 0 && structure.data[0].length != data.length) {
						structure.data = [];
						self.computedData = [];
					}

					// check data's scale
					if (!data || data.length === 0) { dfrd.reject('no'); }
					if (index !== 0 && structure.data[0] && structure.data[0].length != data.length) { console.log('Compare metric has a different scale'); dfrd.reject('no'); }
					else {
						
						// filling edges
						self.filledEdges = false;
						if (data.length == 1) {
							data.splice(0,null,{
								label: '',
								value: 0
							});
							data.splice(2,null,{
								label: '',
								value: 0
							});
							self.filledEdges = true;
						}
						
						// store data
						structure.data[index] = data;

						// if it's first graph
						if (index === 0) {

							// show filters based on elements number
							structure.filters.classed('PAhide', true);
							if (settings.filter.limits) {
								if (structure.data[0].length >= settings.filter.limits.daily) {
	
									if (structure.data[0].length > settings.filter.limits.enable_weekly && settings.filter.mode == 'daily') { settings.filter.mode = 'weekly'; }
									structure.filters.select('p[data-mode="daily"]').classed('PAhide', (structure.data[0].length > settings.filter.limits.enable_monthly));
									structure.filters.select('p[data-mode="monthly"]').classed('PAhide', (structure.data[0].length < settings.filter.limits.disable_weekly));
									if ( structure.data[0].length < settings.filter.limits.disable_weekly && settings.filter.mode == 'monthly' ) { settings.filter.mode = 'daily'; }
	
									structure.filters.selectAll('p').classed('selected', false);
									structure.filters.select('p[data-mode="'+settings.filter.mode+'"]').classed('selected', true);
									
									
									if (structure.data[0].length < settings.filter.limits.enable_monthly || structure.data[0].length >= settings.filter.limits.disable_weekly) {
										setTimeout(function() { structure.filters.classed('PAhide', false);	}, internalSettings.animateGridTime);
									}
	
								} else {
	
									settings.filter.mode = 'daily';
									structure.filters.selectAll('p').classed('selected', false);
									structure.filters.select('p[data-mode="'+settings.filter.mode+'"]').classed('selected', true);
	
								}
							}

						}

						self.computedData[index] = self.applyFilterToData(data, settings.filter.mode);
						var allData = mergeAndClean(self.computedData);
						structure.svg.grid.y.spacing = Yspacing(allData);
						setTimeout(function() { dfrd.resolve('ok');	}, 10);

					}

					return dfrd.promise();

				},

				draw: function() {

					var self = this;

					if (!self.computedData[0]) { return; }

					self.initGridY();
					
					graph.trigger({
						type: 'draw', 
						mode: settings.filter.mode,
						computedData: self.computedData
					});

					promises = [];
					promises.push(self.animateGridX(self.computedData[0]));
					promises.push(self.animateLabelY(self.computedData[0]));

					// flatten graph that need to be flatten
					if (parseInt(structure.svg.element.attr('data-points')) != self.computedData[0].length) {
						for (var i in structure.svg.graph.elements) {
							promises.push(self.flattenGraph(i));
						}
					}

					$.when.apply($, promises).done(function () {
						// Need to get the data returned from all ajax calls here

						graph.find('div.PAlegend').toggleClass('PAhide', self.computedData.length < 2);
						structure.svg.element.attr('data-points', self.computedData[0].length);

						for (var i in structure.svg.graph.elements) {
							if (self.computedData[i]) {

								self.animateGraph(self.computedData[i], i);
							} else {
								self.removeGraph(i);
							}
						}

					});

				},

				// remove graph with index
				removeGraph: function(index) {

					var self = this;
					var dfrd = $.Deferred();
					
					index = index || structure.data.length-1;

					$.when(self.flattenGraph(index))
					.done(function() {
						if (index === 0) { dfrd.reject(); }
						else {
							structure.svg.graph.elements[index].group.remove();
							structure.svg.graph.elements.splice(index,1);
							graph.find('div.PAlegend > p[data-index='+index+']').remove();
							delete structure.data[index];
							self.computedData[index] = null;
							dfrd.resolve();
						}
					})
					.fail(function() {
						dfrd.resolve();
					});

					return dfrd.promise();

				},


				applyFilter: function() {

					var self = this;

					structure.filters.selectAll('p').classed('selected', false);
					structure.filters.select('p[data-mode="'+settings.filter.mode+'"]').classed('selected', true);

					self.computedData[0] = self.applyFilterToData(structure.data[0], settings.filter.mode);
					self.computedData[1] = self.applyFilterToData(structure.data[1], settings.filter.mode);

					var allData = mergeAndClean(self.computedData);
					structure.svg.grid.y.spacing = Yspacing(allData);
					
					self.draw();

				},

				// animate line and area
				animateGraph: function(data, index) {
					var self = this;

					if (!structure.svg.graph.elements[index]) {
						console.log('structure not exist'); return;
					}

					var w = graph.width();
					var h = graph.height();
					var j = 0;

					if (settings.config.grid.x.label !== false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label !== false) {  j = internalSettings.labels.y.width; w = w - j; }

					var spacingX = (data.length == 1) ? w / 2 : w / (data.length - 1);
					var spacingY = (Math.floor(h / 6)) / (structure.svg.grid.y.spacing[1] - structure.svg.grid.y.spacing[0]);

					// remove circles
					structure.svg.graph.circles.selectAll('circle').classed('PAhide', 'true');
					setTimeout(function() {
						structure.svg.graph.circles.selectAll('circle.PAhide').remove();
					}, 300);

					// animate line
					var linesData = []; var linesDataIndex = linesData.length;
					var lineData = []; var lData = [];
					
					for(var i in data) {

						var x = (i * spacingX)	+ j;
						var y = parseInt(h - ((data[i].value - structure.svg.grid.y.spacing[0])  * spacingY ));

						lineData.push({
							'x': x,
							'y': y
						});

						if (!settings.interpolateOnZero) {
							lData.push({
								'x': x,
								'y': y
							});

							if (+data[i].value === 0) {
								linesData.push(lData);
								lData = [];
								lData.push({
									'x': x,
									'y': y
								});
							}
						}

					}

					if (!linesData.length) { linesData.push(lineData); }
					structure.svg.graph.elements[index].elements.points.coords = lineData;
					var lineF = d3.svg.line()
						.x(function(d) { return d.x; })
						.y(function(d) { return d.y; })
						.interpolate(internalSettings.graphLineInterpolation);

					var pathCoord = '';
					if (!settings.interpolateOnZero) {
						for (var ld in linesData) {
							pathCoord += lineF(linesData[ld]);
						}

						var re = /M(.\d*),(.\d*)/;
						var m1 = re.exec(pathCoord)[0];
						pathCoord = m1+pathCoord.replace(/M(.\d*),(.\d*)/gmi,'');
					} else {
						pathCoord = lineF(lineData);
					}

					// complete the area
					pathCoordArea = pathCoord;
					pathCoordArea += 'L'+ getMaxValues(lineData,'x') + ',' + h;
					pathCoordArea += 'L'+ j + ',' + h;
					pathCoordArea += 'L'+ j + ',' + lineData[0].y;

					structure.svg.graph.elements[index].elements.area.transition()
						.duration(internalSettings.graphAnimationTime)
						.attr('d', pathCoordArea)
						.ease(internalSettings.animateEasing);
					structure.svg.graph.elements[index].elements.line.transition()
						.duration(internalSettings.graphAnimationTime)
						.attr('d', pathCoord)
						.ease(internalSettings.animateEasing)
						.each("end",function() {
							self.animateCircles(data, index);
						});

				},

				flattenGraph: function(index) {

					var self = this;
					debug('flattenGraph', index);
					var dfrd = $.Deferred();

					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					if (!structure.svg.graph.elements[index]) {
						dfrd.reject();
						return dfrd.promise();
					}

					var actualPoints = parseInt(structure.svg.element.attr('data-points'));

					if (settings.config.grid.x.label !== false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label !== false) {  j = internalSettings.labels.y.width; w = w - j; }

					var spacingBefore = w / (actualPoints - 1);

					// create flat path with the same point number of the grid to flatten smooth
					var lineData = [];
					for (var i = 0; i < actualPoints; i++) {
						var x = (i * spacingBefore)	+ j;
						lineData.push({
							'x': x,
							'y': h
						});
					}

					var lineF = d3.svg.line()
						.x(function(d) { return d.x; })
						.y(function(d) { return d.y; })
						.interpolate(internalSettings.graphLineInterpolation);
					var pathCoord = lineF(lineData);
					pathCoordArea = pathCoord;
					pathCoordArea += 'L'+ getMaxValues(lineData,'x') + ',' + (h+1);
					pathCoordArea += 'L'+ j + ',' + (h+1);
					pathCoordArea += 'L'+ j + ',' + lineData[0].y;

					// create a fake
					if (self.computedData[index] && self.computedData[index].length) {

						var spacingNext = Math.floor(w / (self.computedData[index].length - 1) );

						// create flat path with the new grid number of points
						lineData = [];
						for (i = 0; i < self.computedData[index].length; i++) {
							var xx = (i * spacingNext)	+ j;
							lineData.push({
								'x': xx,
								'y': h
							});
						}

						lineF = d3.svg.line()
							.x(function(d) { return d.x; })
							.y(function(d) { return d.y; })
							.interpolate(internalSettings.graphLineInterpolation);
						var pathCoordNext = lineF(lineData);
						pathCoordAreaNext = pathCoordNext;
						pathCoordAreaNext += 'L'+ getMaxValues(lineData,'x') + ',' + (h+1);
						pathCoordAreaNext += 'L'+ j + ',' + (h+1);
						pathCoordAreaNext += 'L'+ j + ',' + lineData[0].y;

					}



					structure.svg.graph.circles.selectAll('circle')
						.transition()
						.duration(internalSettings.graphAnimationTime)
						.attr('cy', h)
						.style('opacity', 0)
						.remove();

					structure.svg.graph.elements[index].elements.area.transition()
						.duration(internalSettings.graphAnimationTime)
						.attr('d', pathCoordArea)
						.ease(internalSettings.animateEasing)
						.each('end', function() {
							d3.select(this).attr('d', pathCoordAreaNext);
						});

					structure.svg.graph.elements[index].elements.line.transition()
						.duration(internalSettings.graphAnimationTime)
						.attr('d', pathCoord)
						.ease(internalSettings.animateEasing)
						.each('end', function() {
							d3.select(this).attr('d', pathCoordNext);
							dfrd.resolve();
						});

					return dfrd.promise();

				},

				// fix X grid spacing
				// add or remove lines
				animateGridX: function(data) {

					var self = this;
					debug('animateGridX');

					var dfrd = $.Deferred();
					self.animateLabelX(data);

					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					if (!data) { return; }
					var elementsCount = data.length;

					if (settings.config.grid.x.label !== false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label !== false) {  j = internalSettings.labels.y.width; w = w - j; }

					var spacing = w / (elementsCount-1);

					// fix the number of lines and animate
					// add new lines outside the artboard
					if (elementsCount > structure.svg.grid.x.elements.length) {
						var diff = elementsCount - structure.svg.grid.x.elements.length;
						for (var a = 0; a < diff; a++) {
							var line =  structure.svg.grid.x.group.append('line')
								.attr('x1', w+j+50).attr('y1', 0)
								.attr('x2', w+j+50).attr('y2', h)
								.attr('stroke', settings.config.grid.x.color)
								.attr('data-count', a);
							structure.svg.grid.x.elements.push(line);
						}
					}

					// animate the lines
					for (var i in structure.svg.grid.x.elements) {

						var x = (i * spacing)	+ j;

						structure.svg.grid.x.elements[i].transition()
							.duration(internalSettings.animateGridTime)
							.attr('x1', x)
							.attr('x2', x)
							.ease(internalSettings.animateEasing);


					}

					// remove the lines outside the artboard after the animation
					setTimeout(function() {

						if (elementsCount < structure.svg.grid.x.elements.length) {
							var diff = structure.svg.grid.x.elements.length - elementsCount;
							for (var a = 0; a < diff; a++) {

								var i = a + elementsCount;
								structure.svg.grid.x.elements[i].remove();

							}

							structure.svg.grid.x.elements.splice(elementsCount, diff);
						}

						dfrd.resolve();

					}, internalSettings.animateGridTime);

					return dfrd.promise();

				},

				// fix the number of labels and animate
				// remove the labels outside the artboard
				animateLabelX: function(data) {
					var self = this;
					var dfrd = $.Deferred();
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					if (!data) { return; }
					var elementsCount = data.length;

					if (settings.config.grid.x.label) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label) {  j = internalSettings.labels.y.width; w = w - j; }

					var spacing = w / (data.length-1);

					// hide current labels
					structure.svg.label.x.group.classed('PAhide', true)
						.selectAll('text')
						.classed('PAhide', false);

					// fix the number of labels and position
					setTimeout(function() {
						for(var i in data) {

							var x = (i * spacing)	+ j;

							if (structure.svg.label.x.elements[i]) { // move existing and update text

								structure.svg.label.x.elements[i].attr('x', x)
									.text(settings.config.grid.x.format(data[i].label))
									.attr('text-anchor', 'middle');

							} else { // create new

								var label =  structure.svg.label.x.group.append('text')
									.attr('x', x)
									.attr('y', h+internalSettings.labels.x.marginTop)
									.attr('text-anchor','middle')
									.attr('fill', settings.config.grid.x.label)
									.text(settings.config.grid.x.format(data[i].label));
								structure.svg.label.x.elements.push(label);

							}

						}
						
						structure.svg.label.x.elements[0].attr('text-anchor', 'start');
						structure.svg.label.x.elements[i].attr('text-anchor', 'end');

					}, internalSettings.animateGridTime);

					// remove exceeded
					if (elementsCount < structure.svg.label.x.elements.length) {
						var diff = structure.svg.grid.x.elements.length - elementsCount;
						for (var a = 0; a < diff; a++) {

							var i = a + elementsCount;
							if (structure.svg.label.x.elements[i]) { structure.svg.label.x.elements[i].remove(); }

						}

						structure.svg.label.x.elements.splice(elementsCount, diff);
					}

					setTimeout(function() {
						// show current labels
						structure.svg.label.x.group.classed('PAhide', false);
						self.hideThickLabels();
						dfrd.resolve();
					}, internalSettings.animateGridTime*2);

					return dfrd;

				},

				// hide some labels when there are too much
				hideThickLabels: function() {
					
					var self = this;
					var w = structure.svg.label.x.group.select('text:nth-child(2)')[0][0].getBBox().width;
					var start = parseFloat(structure.svg.label.x.group.select('text:nth-child(1)').attr('x'));
					var x = 1;
					
					structure.svg.label.x.group
						.selectAll('text:nth-child(n+2)')
						.each(function() {

							var p = parseFloat(d3.select(this).attr('x')) - (w/2);
							if (p > start+w) { 	return false;	}
							x++;

						});
											
					if (x > 1) {
						structure.svg.label.x.group
							.selectAll('text:not(:nth-child('+ x +'n+1))')	
							.classed('PAhide', true);
					}
				
				},

				// fix the number of labels and animate
				// remove the labels outside the artboard
				animateLabelY: function(data) {
					var self = this;
					debug('animateLabelY');
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					if (!data) { return; }

					if (settings.config.grid.x.label) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label) {  j = internalSettings.labels.y.width; w = w - j; }

					var elementsCount = 6;
					var spacing = Math.floor(h / elementsCount);

					// hide current labels
					structure.svg.label.y.group.classed('PAhide', true);

					// fix the number of labels and position
					setTimeout(function() {
						for (var i = 0; i < elementsCount; i++) {

							if (structure.svg.label.y.elements[i]) { // move existing and update text

								structure.svg.label.y.elements[i].text(Number(structure.svg.grid.y.spacing[i]).format(settings.config.grid.y.format))

							} else {
																
								var label =  structure.svg.label.y.group.append('text')
									.attr('x', 50)
									.attr('y', h - (i*spacing))
									.attr('text-anchor','end')
									.attr('fill', settings.config.grid.y.label)
									.text(Number(structure.svg.grid.y.spacing[i]).format(settings.config.grid.y.format))
								structure.svg.label.y.elements.push(label);
							}

						}

					}, internalSettings.animateGridTime);

					setTimeout(function() {
						// show current labels
						structure.svg.label.y.group.classed('PAhide', false);
					}, internalSettings.animateGridTime*2)

				},

				// animate the circles
				animateCircles: function(data, index) {

					var self = this;
					
					for (var i in structure.svg.graph.elements[index].elements.points.coords) {
						
						var append = true;
						
						if (self.filledEdges && (i === 0 || i == structure.svg.graph.elements[index].elements.points.coords.length-1)) {
							append = false;
						}
						
						if (append) {
							var coords = structure.svg.graph.elements[index].elements.points.coords[i];
							var circle = structure.svg.graph.circles.append('circle')
								.attr('cx', coords.x)
								.attr('cy', coords.y)
								.attr('r', 0)
								.attr('stroke-width', 2)
								.attr('stroke', settings.config.graph[index].color)
								.attr('fill', '#fff')
								.attr('data-value', data[i].value)
								.attr('data-index', index)
								.attr('rel', i)
								.transition()
								.delay(i*20)
								.attr('r', 2)
								.ease(internalSettings.animateEasing)
							structure.svg.graph.elements[index].elements.points.elements.push(circle);
						}
					}

				},

				// change legend labels on the go
				setLegendLabel: function(label, index) {

					var self = this;
					settings.config.graph[index].legend = label;
					structure.legend.select('p[data-index="'+ index +'"] > label').text(label);

				},

				// action on circles
				initCircles: function() {
					var self = this;

					var displayNoneTimer = null;

					graph
						.on('mouseover', 'circle', function() {

							structure.tooltip.style('display', 'block');
							clearTimeout(displayNoneTimer);

							// label and value
							var index = $(this).attr('data-index');
							var value = $(this).attr('data-value');
							var xIndex = $(this).attr('rel');
							var time = graph.find('g.PAGlabelX > text:eq('+ xIndex +')').text();

							structure.tooltip
								.select('span.time').text(time)
								.style('background-color', settings.config.graph[index].color)

							structure.tooltip
								.style('color', settings.config.graph[index].color)
								.select('span.metric').html(Number(value).format(settings.config.graph[index].format));

							structure.tooltip
								.select('label').text(settings.config.graph[index].legend);

							// set tooltip position
							var size = structure.tooltip.node().getBoundingClientRect();

							var t = $(structure.tooltip[0][0]),
								w = t.width(),
								h = t.height()

							var px = $(this).attr('cx'),
								py = $(this).attr('cy')

							var top = py - h - 20,
								left= px - parseInt(w/2)-10

							t.css('top', top)
								.css('left',left)
								.addClass('show')

						})
						.on('mouseout', 'circle', function() {
							structure.tooltip.classed('show', false);
							displayNoneTimer = setTimeout(function() {
								structure.tooltip.style('display', 'none');
							}, 300)
						})

				},

				// move the selected graph on front
				moveOnFront: function(index) {

					var self = this;
					var g = graph.find('g.PAGgraphs');
					g.find('g.PAGgraph[data-index='+index+']').appendTo(g);

				},

				// filter data
				applyFilterToData: function(data, filter) {

					var self = this;
					var filter = filter || 'daily';
					var newData = data;

					if (data == null) { return null; }

					switch(filter) {
						case 'weekly': newData = weekly(data); break;
						case 'monthly': newData = monthly(data); break;
						case 'daily': newData = daily(data); break;
					}

					return newData;

					// in daily mode there are no filter applied
					function daily(data) { return data; 	}

					// in weekly mode the data are groupped in 7 days
					// TODO verify if this shoud group by week (mon/sun)
					//				verify how to group the labels
					function weekly(data) {

						var newData = [],
							tmpObjModel = {
								"label": "",
								"value": 0
							},
							tmpObj = {},
							index = 0;

						for (var i in data) {

							// first
							if (i % 7 === 0) {
								tmpObj = $.extend(true, {}, tmpObjModel);
								tmpObj.label = data[i].label;
								newData.push(tmpObj);
								index = newData.length - 1;
							}

							newData[index].value += data[i].value;

						}

						return newData;
					}

					// in monthly mode the data are groupped in 30 days
					// TODO verify if this shoud group by month
					function monthly(data) {

						var newData = [],
							tmpObjModel = {
								"label": "",
								"value": 0
							},
							tmpObj = {},
							index = 0;

						for (var i in data) {

							// first
							if (i % 30 === 0) {
								tmpObj = $.extend(true, {}, tmpObjModel);
								tmpObj.label = data[i].label;
								newData.push(tmpObj);
								index = newData.length - 1;
							}

							newData[index].value += data[i].value;

						}

						return newData;
					}

				},

			},

			bars: {

				// start with a week structure
				init: function() {

					debug('MODE: weekday');

					var self = this;

					self.grid();

				},

				grid: function() {

					var self = this;

					self.initGridY();
					self.initLegend();
					self.initRects();

				},

				/* INIT */
				// create empty grid without label
				initGridY: function() {
					var self = this;

					var w = graph.width();
					var h = graph.height();
					var j = 0;

					if (settings.config.grid.x.label !== false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label !== false) {  j = internalSettings.labels.y.width; w = w - j; }

					var elementsCount = 6;

					var spacing = Math.floor(h / elementsCount);
					structure.svg.grid.group.select('g.PAGgridY').remove();
					structure.svg.grid.y.group = structure.svg.grid.group.append('g').classed('PAGgridY', true);


					for (var i = 0; i < elementsCount; i++) {

						var line =  structure.svg.grid.y.group.append('line')
							.attr('x1', j).attr('y1', h - (i*spacing))
							.attr('x2', graph.width()).attr('y2', h - (i*spacing))
							.attr('stroke', settings.config.grid.y.color)
						structure.svg.grid.y.elements.push(line);

					}

				},

				// create flat graph
				initGraph: function(index_wanted, color, legend, format) {
										
					var self = this;
					var dfrd = $.Deferred();

					if (typeof index_wanted != undefined && structure.svg.graph.elements[index_wanted]) {
						dfrd.resolve(index_wanted);
						return dfrd.promise();
					}

					var startElements = (structure.data[0]) ? structure.data[0].length : 5;
					var w = graph.width();
					var h = graph.height();
					var j = 0;

					var graphElements = $.extend(true, {}, graphElementsEmpty);

					graphElements.group = structure.svg.graph.group.insert('g',':first-child')
						.classed('PAGgraph', true)
					graphElements.elements.area = [];
					structure.svg.graph.elements.push(graphElements);

					var index = structure.svg.graph.elements.length - 1;
					structure.svg.graph.elements[index].group.attr('data-index', index);

					// create settings structure
					var color = color || "#"+((1<<24)*Math.random()|0).toString(16);
					var legend = legend || 'Graph '+index;
					var format = format || null;

					settings.config.graph.push({
						color: color,
						legend: legend,
						format: format
					});

					debug('initGraph', index_wanted);
					
					if (settings.config.grid.x.label !== false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label !== false) {  j = internalSettings.labels.y.width; w = w - j; }
					var spacing = Math.floor(w/startElements);
					var offsetX = (settings.config.stacked) ? 0 : settings.config.spacing / 2;
					var rectW = spacing - settings.config.spacing - ((structure.svg.graph.elements.length-1) * offsetX);
										
					for (var i = 0; i < startElements; i++) {

						var x = (i * spacing) + j + (spacing / 2) - (rectW / 2) + (index * offsetX);
						var y = h-1;
						
						var rect = structure.svg.graph.elements[index].group.append('rect')
							.attr('x', x)
							.attr('y', y)
							.attr('width', rectW)
							.attr('height', 1)
							.attr('rx', settings.config.rectRadius)
							.attr('ry', settings.config.rectRadius)
							.attr('fill', settings.config.graph[index].color)
							.style('opacity', 0)
						structure.svg.graph.elements[index].elements.area.push(rect);

					}

					// add label to legend
					var p = structure.legend.append('p')
						.attr('data-index', index)
					p.append('span')
						.style('background', settings.config.graph[index].color);
					p.append('label')
						.text(settings.config.graph[index].legend);

					if (index === 0) { self.initLabelX(); }

					// resolve with index at the end of DOM creation
					setTimeout(function() {	dfrd.resolve(index); }, startElements * 25);

					return dfrd.promise();

				},

				initLabelX: function() {

					var self = this;
					var startElements = 5;
					
					debug('initLabelX')
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;

					if (settings.config.grid.x.label !== false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label !== false) {  j = internalSettings.labels.y.width; w = w - j; }
					var spacing = Math.floor(w/startElements);

					for (var i = 0; i < startElements; i++) {

						var x = (i * spacing) + j + (spacing / 2);

						var label =  structure.svg.label.x.group.append('text')
							.attr('x', x)
							.attr('y', h+internalSettings.labels.x.marginTop)
							.attr('text-anchor','middle')
							.attr('fill', settings.config.grid.x.label)
						structure.svg.label.x.elements.push(label);

					}

				},

				// fix the number of labels and animate
				// remove the labels outside the artboard
				animateLabelY: function() {
					var self = this;
					var data = self.computedData;
					var w = graph.width();
					var h = graph.height();
					var j = 0;

					debug('animateLabelY')
					if (!data) { return; }
					var elementsCount = data.length;

					if (settings.config.grid.x.label) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label) {  j = internalSettings.labels.y.width; w = w - j; }

					var elementsCount = 6;
					var spacing = Math.floor(h / elementsCount);

					// hide current labels
					structure.svg.label.y.group.classed('PAhide', true);

					// fix the number of labels and position
					setTimeout(function() {
						for (var i = 0; i < elementsCount; i++) {

							if (structure.svg.label.y.elements[i]) { // move existing and update text

								structure.svg.label.y.elements[i].text(Number(structure.svg.grid.y.spacing[i]).format(settings.config.grid.y.format))

							} else {
								var label =  structure.svg.label.y.group.append('text')
									.attr('x', 50)
									.attr('y', h - (i*spacing))
									.attr('text-anchor','end')
									.attr('fill', settings.config.grid.y.label)
									.text(Number(structure.svg.grid.y.spacing[i]).format(settings.config.grid.y.format))
								structure.svg.label.y.elements.push(label);
							}

						}

					}, internalSettings.animateGridTime);

					setTimeout(function() {
						// show current labels
						structure.svg.label.y.group.classed('PAhide', false);
					}, internalSettings.animateGridTime*2)

				},

				animateGridX: function() {

					var self = this;
					var dfrd = $.Deferred();
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					if (settings.config.grid.x.label !== false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label !== false) {  j = internalSettings.labels.y.width; w = w - j; }
					
					debug('animateGridX');
					if (!structure.data[0]) { return; }
					
					
					structure.svg.label.x.group.classed('PAhide', true)
					
					var spacing = settings.config.stacked;
					
					var spacingX = Math.floor(w/structure.data[0].length);
					var offsetX = (settings.config.stacked) ? 0 : spacing / 2;					
					var rectW = spacingX - spacing;

					if (spacingX > 0) {
	
						while (rectW <= spacing) {
							spacing = spacing-1;
							offsetX = (settings.config.stacked) ? 0 : spacing / 2;
							rectW = spacingX - spacing - ((structure.svg.graph.elements.length-1)*offsetX);
						}
						
						if (spacing === 0) {
							offsetX = 0;
							rectW = w /structure.data[0].length;
							spacingX = rectW;
						}
					} else {
						offsetX = 0;
						rectW = w /structure.data[0].length;
						spacingX = rectW;
					}

					// fix the number of the rows
					if (structure.svg.graph.elements[0].elements.area.length != structure.data[0].length) {
												
						// remove exceding
						for (var i = structure.data[0].length; i < structure.svg.graph.elements[0].elements.area.length; i++) {
							
							structure.svg.label.x.elements[i].transition()
								.duration(internalSettings.graphAnimationTime)
								.style('opacity', 0)
								.ease(internalSettings.animateEasing)
								.each("end", function() {
									this.remove();
								});
								
							setTimeout(function() {
								structure.svg.label.x.elements = structure.svg.label.x.elements.slice(0,structure.data[0].length);
							}, internalSettings.graphAnimationTime)
							
						}
																		
						for (var index in structure.data) {

							for (var i in structure.data[index]) {

								var x = (i * spacingX) + j + (spacingX / 2) - (rectW / 2) + (index * offsetX);

								if (structure.svg.graph.elements[index].elements.area[i]) {

									structure.svg.graph.elements[index].elements.area[i]
										.transition()
										.duration(internalSettings.graphAnimationTime)
										.attr('width', rectW)
										.attr('x', x)

								} 
								else {
																		
									var rect = structure.svg.graph.elements[index].group
										.append('rect')
										.attr('x', x)
										.attr('y', h-1)
										.attr('width', rectW)
										.attr('height', 1)
										.attr('rx', settings.config.rectRadius)
										.attr('ry', settings.config.rectRadius)
										.attr('fill', settings.config.graph[index].color)
										.attr('opacity', 0)
									rect
										.transition()
										.delay(internalSettings.graphAnimationTime / 4)
										.duration(internalSettings.graphAnimationTime)
									structure.svg.graph.elements[index].elements.area.push(rect);

								}

								if (index === 0) {

									var xx = (i * spacingX) + j + (spacingX / 2);
									if (structure.svg.label.x.elements[i]) {

										structure.svg.label.x.elements[i]
											.transition()
											.duration(internalSettings.graphAnimationTime / 4)

										structure.svg.label.x.elements[i]
											.transition()
											.delay(internalSettings.graphAnimationTime / 4)
											.duration(internalSettings.graphAnimationTime)
											.attr('x', xx)
											.text(settings.config.grid.x.format(structure.data[0][i].label));


									} else {
										var label =  structure.svg.label.x.group
											.append('text')
											.attr('x', xx)
											.attr('y', h+internalSettings.labels.x.marginTop)
											.attr('text-anchor','middle')
											.attr('fill', settings.config.grid.x.label)
											.text(settings.config.grid.x.format(structure.data[0][i].label))

										label
											.transition()
											.delay(internalSettings.graphAnimationTime / 4)
											.duration(internalSettings.graphAnimationTime)

										structure.svg.label.x.elements.push(label);
									}

								}

							}

						}

					}
					// only fix the labels and positions
					else {

						for (var i in structure.data[0]) {
							
							var xx = (i * spacingX) + j + (spacingX / 2);
							
							structure.svg.label.x.elements[i]
								.transition()
								.delay(internalSettings.graphAnimationTime / 4)
								.duration(internalSettings.graphAnimationTime)
								.attr('x', xx)
								.text(settings.config.grid.x.format(structure.data[0][i].label));
							
						}
					}

					// resolve the deferred
					setTimeout(function() { 
						self.hideThickLabels();
						dfrd.resolve();						
					}, internalSettings.animateGridTime + 100);

					return dfrd.promise();

				},
				
				// hide some labels when there are too much
				hideThickLabels: function() {
					
					debug('hideThickLabels');
					
					var self = this;
					var labelGroup = graph.find('g.PAGlabelX')					
					var nthChildX = 1;
					var l1_index = 1;
					var l1_element = labelGroup.find('text:eq('+(l1_index)+')');
					var l1_size = {
						width: textWidth(l1_element),
						x: l1_element.position().left
					};
					var l2_index = 2;
					var l2_size = labelGroup.find('text:eq('+(l2_index)+')').position().left;

					while (l1_size.x + l1_size.width + 10 > l2_size) {
						nthChildX++; l2_index++;
						if (labelGroup.find('text:eq('+(l2_index)+')').length) {
							l2_size = labelGroup.find('text:eq('+(l2_index)+')').position().left;
						} else {
							break;
						}
					}

					if (nthChildX > 1) {
						structure.svg.label.x.group
							.classed('PAhide', true)
								.selectAll('text:nth-child('+nthChildX+'n+2)')
								.classed('show', true);
					} else {
						structure.svg.label.x.group
							.classed('PAhide', false)
								.selectAll('text')
								.classed('show', false);
					}
					

					function textWidth(element) {
						var fake = $('<span>').hide().appendTo(document.body);
						fake.text(element.text())
							.css('font-family', element.css('font-family'))
							.css('font-weight', element.css('font-weight'))
							.css('font-size', element.css('font-size'))
							.css('text-transform', element.css('text-transform'))
						var w = fake.width(); fake.remove();
						return w;
					}

				},				

				/* ANIMATE */
				setData: function(data, index) {

					var self = this;
					var dfrd = $.Deferred();
					var index = index || 0;
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;

					if (settings.config.grid.x.label !== false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label !== false) {  j = internalSettings.labels.y.width; w = w - j; }					

					debug('setData', index)

					// empty stored data with different scale on index 0
					if (structure.data.length && index === 0 && structure.data[0].length != data.length) {
						structure.data = [];
					}
					
					// fix elements number
					if (structure.svg.graph.elements[index].elements.area.length > data.length) {
						for (i = data.length; i < structure.svg.graph.elements[index].elements.area.length; i++) {
							
							// remove rect
							structure.svg.graph.elements[index].elements.area[i].transition()
								.duration(internalSettings.graphAnimationTime)
								.attr('y', h)
								.attr('height', 0)
								.style('opacity', 0)
								.ease(internalSettings.animateEasing)
								.each("end", function() {
									this.remove();
								});
								
						}
						
						setTimeout(function() {
							structure.svg.graph.elements[index].elements.area = structure.svg.graph.elements[index].elements.area.slice(0,data.length);
						}, internalSettings.graphAnimationTime)
						
					}
					

					// check data's scale
					if (!data || data.length === 0) { dfrd.reject('no'); }
					if (index != 0 && structure.data[0] && structure.data[0].length != data.length) { console.log('Compare metric has a different scale'); dfrd.reject('no'); }
					else {

						// store data
						structure.data[index] = data;
						self.computedData = mergeAndClean(structure.data);
						structure.svg.grid.y.spacing = Yspacing(mergeAndCleanArr(structure.data));
						setTimeout(function() { dfrd.resolve('ok');	}, 10);

					}

					return dfrd.promise();

				},

				draw: function() {

					var self = this;

					debug('draw')
					
					self.initGridY();

					promises = [];
					promises.push(self.animateLabelY());
					promises.push(self.animateGridX());

					$.when.apply($, promises).done(function () {

						graph.find('div.PAlegend').toggleClass('PAhide', structure.data.length < 2);
						for (var i in structure.svg.graph.elements) {
							if (structure.data[i]) {
								self.animateGraph(structure.data[i], i);
							} else {
								self.removeGraph(i);
							}
						}

					});

				},

				// animate line and area
				animateGraph: function(data, index) {
					var self = this;
					var index = index || 0;
					debug('animateGraph', index)
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;

					if (settings.config.grid.x.label !== false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label !== false) {  j = internalSettings.labels.y.width; w = w - j; }
					
					var spacing = settings.config.spacing;
					
					var spacingX = Math.floor(w /data.length);
					var spacingY = (Math.floor(h / 6)) / (structure.svg.grid.y.spacing[1] - structure.svg.grid.y.spacing[0]);
					var offsetX = (settings.config.stacked) ? 0 : spacing / 2;
					var rectW = spacingX - spacing - ((structure.svg.graph.elements.length-1)*offsetX);
					
					if (spacingX > 0) {
						while (rectW <= spacing) {
							spacing = spacing-1;
							offsetX = (settings.config.stacked) ? 0 : spacing / 2;
							rectW = spacingX - spacing - ((structure.svg.graph.elements.length-1)*offsetX);
						}
						
						if (spacing === 0) {
							offsetX = 0;
							rectW = w /data.length;
							spacingX = rectW;
						}
					} else {
						offsetX = 0;
						rectW = w /data.length;
						spacingX = rectW;
					}
										
					for (var i in structure.svg.graph.elements[index].elements.area) {
												
						var x = (i * spacingX) + j + (spacingX / 2) - (rectW / 2) + (index * offsetX);

						if (typeof data[i] != 'undefined') {
							
							var he = (data[i].value) ? parseInt( ( data[i].value * spacingY) - (structure.svg.grid.y.spacing[0] * spacingY ) ) : 1;
							if (he < 1) { he = 1; }
							var y = h - he;
							if (settings.config.stacked && index > 0) {
								var p = index * 1;
								while(p > 0) {
									p = p-1;
									var he0 = (structure.data[p][i].value) ? parseInt( ( structure.data[p][i].value * spacingY) - (structure.svg.grid.y.spacing[0] * spacingY ) ) : 1;
									y = y - he0;
								}
							}
													
							structure.svg.graph.elements[index].elements.area[i].transition()
								.duration(internalSettings.graphAnimationTime)
								.attr('x', x)
								.attr('y', y)
								.attr('width', rectW)
								.attr('height', he)
								.attr('data-value', data[i].value)
								.style('opacity', 1)
								.ease(internalSettings.animateEasing)
						
						}	
							
					}

				},

				// remove graph at index
				flattenGraph: function(index) {

					var self = this;
					var dfrd = $.Deferred();
					
					debug('flattenGraph', index);
					
					if (structure.data[index] == null) { dfrd.reject(); return dfrd.promise(); }

					var h = graph.height();
					if (settings.config.grid.x.label !== false) { h = h - internalSettings.labels.x.height; }

					structure.svg.graph.elements[0].group.classed('percentage', false);

					// flatten compare
					for (var i in structure.svg.graph.elements[index].elements.area) {
						
						structure.svg.graph.elements[index].elements.area[i].transition()
							.duration(internalSettings.graphAnimationTime)
							.attr('y', h-1)
							.attr('height', 1)
							.ease(internalSettings.animateEasing)

					}

					setTimeout(function() {
						dfrd.resolve();
					}, internalSettings.graphAnimationTime+10);

					return dfrd.promise();

				},

				removeGraph: function(index) {

					var self = this;
					var dfrd = $.Deferred();
					
					var index = index || structure.svg.graph.elements.length-1
										
					$.when(self.flattenGraph(index))
						.done(function() {
							
							if (index === 0) { dfrd.reject();  }
							else {					
								delete structure.data[index];
								structure.svg.graph.elements[index].group.remove();
								structure.svg.graph.elements.pop();
								graph.find('div.PAlegend > p[data-index='+index+']').remove()
								self.computedData = mergeAndClean(structure.data);
								structure.svg.grid.y.spacing = Yspacing(mergeAndCleanArr(structure.data));
								dfrd.resolve();
							}
						})

					return dfrd.promise();

				},

				// action on legend
				initLegend: function() {

					var self = this;

					graph.find('div.PAlegend')
						.on('click', 'p[data-index]', function() {
							var index = parseInt($(this).attr('data-index'));
							self.moveOnFront(index);
						})


				},

				// change legend labels on the go
				setLegendLabel: function(label, index) {

					var self = this;
					settings.config.graph[index].legend = label;
					structure.legend.select('p[data-index="'+ index +'"] > label').text(label);

				},

				// tooltip
				initRects: function() {
					var self = this;

					var displayNoneTimer = null;

					graph
						.on('mouseover', 'g.PAGgraph > rect', function() {

							clearTimeout(displayNoneTimer);
							structure.tooltip.style('display', 'block');

							// label and value
							var index = $(this).parent('g').attr('data-index');
							
							var formatTooltip = (settings.config.graph[index].format) ? settings.config.graph[index].format : settings.config.grid.y.format;
							var xIndex = $(this).index();
							var time = graph.find('g.PAGlabelX > text:eq('+ xIndex +')').text();

							structure.tooltip
								.select('span.time').text(time)
								.style('background-color', settings.config.graph[index].color)
							
							structure.tooltip
								.style('color', settings.config.graph[index].color)
								.select('span.metric').text(Number($(this).attr('data-value')).format(formatTooltip));
								
							structure.tooltip
								.select('label').text(settings.config.graph[index].legend);

							// set tooltip position
							var size = structure.tooltip.node().getBoundingClientRect();

							var t = $(structure.tooltip[0][0]),
								w = t.width(),
								h = t.height()

							var px = $(this).attr('x'),
								py = $(this).attr('y'),
								pw = $(this).attr('width')

							var top = py - h - 8,
								left= px - parseInt((w/2) - (pw/2)) - 10

							t.css('top', top)
								.css('left',left)
								.addClass('show')

						})
						.on('mouseout', 'g.PAGgraph > rect', function() {
							structure.tooltip.classed('show', false);
							displayNoneTimer = setTimeout(function() {
								structure.tooltip.style('display', 'none');
							}, 300)
						})

				},

				initCompareValues: function() {

					var self = this;

					if (structure.data[1] == null) return;

					var h = graph.height();
					if (settings.config.grid.x.label !== false) { h = h - internalSettings.labels.x.height; }

					for (var i in structure.data[0]) {

						var diff = structure.data[0][i].value - structure.data[1][i].value;
						var perc = Math.round(diff / structure.data[1][i].value * 100);

						perc = (perc > 0) ? '+'+perc+'%' : (perc === 0) ? '' : perc+'%';

						if (structure.svg.graph.elements[0].elements.points.elements[i]) {

							structure.svg.graph.elements[0].elements.points.elements[i].text(perc);

						} else {

							var rect = structure.svg.graph.elements[0].elements.area[i];
							var x = parseInt(rect.attr('x')) + parseInt(rect.attr('width') / 2);

							var text = structure.svg.graph.elements[0].group.append('text')
								.attr('x', x)
								.attr('y', h - (internalSettings.labels.x.marginTop/2))
								.attr('text-anchor','middle')
								.attr('fill', '#fff')
								.text(perc)

							structure.svg.graph.elements[0].elements.points.elements.push(text);

						}
					}

					setTimeout(function() {
						structure.svg.graph.elements[0].group.classed('percentage', true);
					}, internalSettings.graphAnimationTime)


				},

				// move the selected graph on front
				moveOnFront: function(index) {

					var self = this;
					var g = graph.find('g.PAGgraphs');
					g.find('g.PAGgraph[data-index='+index+']').appendTo(g);

				},

			},
			
			vertical_bar: $.extend(true, null, this.bars)

		}

		MODE[settings.mode].init();

		graph.initGraph = function(index_wanted, color, legend, format) {

			return MODE[settings.mode].initGraph(index_wanted, color, legend, format);

		};

		graph.setData = function(data, index) {

			if (typeof settings.preFetch == 'function') { var data = settings.preFetch(data); }
			return MODE[settings.mode].setData(data, index);

		};
		
		graph.getData = function(index) {
			return structure.data[index];
		};
		
		graph.getFormat = function() {
			return settings.config.grid.y.format
		};

		graph.removeGraph = function(index) {

			return MODE[settings.mode].removeGraph(index);

		};

		graph.draw = function() {

			MODE[settings.mode].draw();

		}

		graph.setLegendLabel = function(label, index) {

			MODE[settings.mode].setLegendLabel(label, index);

		}
		
		if (settings.debug) {
			graph.structure = structure
			graph.MODE = MODE
		}

		function getRandomColor() {
			return '#'+(Math.random()*0xFFFFFF<<0).toString(16);
		}

		function Yspacing(data, lines) {

			var lines = lines || 5;
			
			var multiplier = 1;

			var max = getMaxValues(data);
			var min = (settings.config.stacked) ? 0 : getMinValues(data);
						
			if (max <= 1.5) {
				multiplier = 10;
			}
			
			if (max - min <= lines) {
				multiplier = 1;
			}
			
			min = min * multiplier;
			max = max * multiplier;
			
			if (min == max) {return Array.apply(null, Array(lines+1)).map(function(e,i){ return min+(10*(i-1)) });	}

			if (max - min > lines) {
				var percMin = (min) ? Math.ceil((max - min) * 0.05) : 0;
				var percMax = Math.ceil((max - min) * 0.05);
				min -= percMin;
				max += percMax;

				var space = Math.round((max - min) / lines);
				var divisor = (space.toString().length - 1) * 10 || 1;
				var spacer = (Math.round(2 * space / divisor) / 2) * divisor
				
			} else {

				var space = (max - min) / lines;
				var spacer = space;
				var multiplier = 1;
			}
			
			var bottom = Math.floor(min / spacer) * spacer / multiplier;

			var labels = [];
			for (var i = 0; i <= lines; i++) {
				labels.push(Number(bottom));
				bottom += spacer / multiplier;
			}

			return labels;

		}

		function mergeAndClean(arr) {

			var result = [];
			for (var i in arr) {
				for (var x in arr[i]) {
					result.push(arr[i][x]);
				}
			}

			return result;

		}
		
		function mergeAndCleanArr(data) {
			
			var arr = $.extend(true,null,data);
			var result = [];
			
			$.each(arr, function(i,e) {
				
				$.each(e, function(j,f) {
					if (i === 0) { result[j] = f }
					else { 
						if (settings.config.stacked) {
							result[j].value += f.value	
						} else {
							result.push(f);
						}
					}
				})
				
			});
			return result;

		}

		function debug() {
			if (settings.debug) { console.debug(arguments);	}
		}

		return graph;

	};

	// donut chart
	$.fn.PAdonutchart = function( options ) {
		var graph = this;
		graph.addClass('PAgraphContainer PAdonutchart');

		var settings = $.extend(true, {
			after: null,
			entry_limit: {
				label:"Other",
				number:null
			}
		}, options.settings);

		var structure = {
			legend:null,
			tooltip:null,
			data:[],
			filters:null,
			svg: {
				radius:null,
				element:null,
				pie:null,
				arc:null,
				outer_arc:null,
				key:null,
				color:null,
				g:null
			}
		};

		// legend
		structure.legend = d3.selectAll(graph.get()).append('div')
			.classed('PAlegend', true);

		// tooltip
		structure.tooltip = d3.selectAll(graph.get()).append('div')
			.classed('PAtooltip', true);

		structure.tooltip.append('span').classed('metric', true).text('');
		structure.tooltip.append('label').text('');

		structure.svg.element = d3.selectAll(graph.get()).append('svg')
			.classed('PAGraph', true)
			.attr('width', '100%')
			.attr('height', graph.height());

		structure.svg.radius = Math.min(graph.width(), graph.height() - 40) / 2;

		structure.svg.g = structure.svg.element.append('g')
			.attr('class', 'slices');

		structure.svg.pie = d3.layout.pie()
			.sort(null)
			.value(function(d) {
				return d.value;
			});

		structure.svg.arc = d3.svg.arc()
			.outerRadius(structure.svg.radius * 0.8)
			.innerRadius(structure.svg.radius * 0.4);

		structure.svg.outer_arc = d3.svg.arc()
			.outerRadius(structure.svg.radius * 0.9)
			.innerRadius(structure.svg.radius * 0.9);

		structure.svg.g.attr("transform", "translate(" + (graph.width() / 4) + "," + (graph.height() - 50) / 2 + ")");

		structure.svg.key = function(d) { return d.data.label; };

		function trim_data(data, limit, label) {
			if(data.length > limit) {
				var sorted_array = data.sort(function(a, b) {
					return a.value - b.value;
				});
				var descending = sorted_array.reverse();
				var other = descending.splice(limit - 1, data.length);
				var sum = 0;
				other.map(function(key) {
					sum += key.value;
				});
				descending[descending.length] = {
					label:label,
					value:sum
				};
				data = descending;
			}
			return data;
		}

		function set_data(data) {
			if(!!settings.entry_limit.number) {
				data = trim_data(data, settings.entry_limit.number, settings.entry_limit.label);
			}
			return data.map(function(set) {
				return { label:set.label, value:set.value }
			});
		}

		// options.data = set_data(options.data);


		function set_domain_and_range(data) {
			var colors = ["#6D96A1", "#596970", "#A9AEC5", "#553E5A", "#859680", "#8C4354", "#87B8C4", "#808F96"];
			var domain = [];

			for(var x = 0; x < data.length; x++) {
				domain.push(data[x].label);
			}

			structure.svg.color = d3.scale.ordinal()
				.domain(domain)
				.range(colors);
		}

		function init_graph(data) {
			var displayNoneTimer = null;

			var slice = structure.svg.element.select('.slices').selectAll('path')
				.data(structure.svg.pie(data), structure.svg.key);

			slice.enter()
				.append('path')
				.style('fill', function(d) {
					return structure.svg.color(d.data.label);
				})
				.attr('class', 'slice');

			slice.transition().duration(1000)
				.attrTween('d', function(d) {
					var i = d3.interpolate(d.startAngle + 0.1, d.endAngle);
					return function(t) {
						d.endAngle = i(t);
						return structure.svg.arc(d);
					}
				});

			slice.on('mouseover', function() {
				var mouseover_object = arguments[0];
				clearTimeout(displayNoneTimer);
				structure.tooltip.style('display', 'block');
				structure.tooltip.select('span').text(mouseover_object.data.label);
				if(!!settings.after) {
					structure.tooltip.select('label').text(mouseover_object.data.value + ' ' + settings.after);
				} else {
					structure.tooltip.select('label').text(mouseover_object.data.value);
				}

				var t = $(structure.tooltip[0][0]);

				t.addClass('show')
					.css('left', d3.event.layerX + 10  + 'px')
					.css('top', d3.event.layerY + 10 + "px")

			});

			slice.on('mouseout', function() {
				structure.tooltip.classed('show', false);
				displayNoneTimer = setTimeout(function() {
					structure.tooltip.style('display', 'none');
				}, 300);
			});

			slice.exit().remove();
		}

		function init_legend(data) {
			var client = $(structure.svg.element)[0][0];

			structure.legend.selectAll('p').remove();

			var legend = structure.legend
				.selectAll('p')
				.data(data)
				.enter()
				.append('p')
				.attr('data-index', function(d, i) {
					return i;
				});

			legend.append('span')
				.attr('opacity', 0)
				.transition()
				.duration(500)
				.delay(1000)
				.attr('opacity', 1)
				.style('background', function(d) {
					return structure.svg.color(d.label);
				});

			legend.append('label')
				.attr('opacity', 0)
				.transition()
				.duration(500)
				.delay(1000)
				.attr('opacity', 1)
				.text(function(d) {
					return d.label;
				});

			legend.classed('small', legend[0].length > 3);

		}

		graph.animate = function (data) {

			options.data = set_data(data);

			init_graph(options.data);
			init_legend(options.data);

		};

		graph.init = function(data) {

			options.data = set_data(data);

			set_domain_and_range(options.data);
			init_graph(options.data);
			init_legend(options.data);
		};

		graph.init(options.data);

		return graph;
	};

	// bubble chart
	$.fn.PAbubblechart = function ( options ) {

		var settings = {
			margin: {
				top:0 || options.margin.top,
				right:0 || options.margin.right,
				bottom:0 || options.margin.bottom,
				left:0 || options.margin.left
			}
		};



		var structure = {
			legend:null,
			tooltip:null,
			data:[],
			filters:null,
			svg: {
				element:null,
				g:null,
				xRange:null,
				yRange:null,
				xAxis:null,
				yAxis:null,
				color:null
			}
		};

		var graph = this;
		graph.addClass('PAbubblechartContainer');


		var CHART = {
			init:function(data) {
				var w = graph.width() - settings.margin.left - settings.margin.left;
				var h = graph.height() - settings.margin.top - settings.margin.bottom;
				var n = 6;
				var m = 1;
				var padding = 6;
				var radius = d3.scale.sqrt().range([0, 12]);
				structure.svg.color = d3.scale.category20c().domain(d3.range(m));
				var x = d3.scale.ordinal().domain(d3.range(m)).rangePoints([0, w], 1);
				var center = {
					x: w / 3,
					y: h / 2
				};

				var damper = .1;

				var max_amount = d3.max(data, function(d) {
					return d.value;
				}),
					radius_scale = d3.scale.pow()
						.exponent(0.5)
						.domain([0, max_amount])
						.range([1, 27]),
					nodes = [];

				data.forEach(function(d) {
					var node;
					node = {
						id: d.id,
						value: d.value,
						percentage: d.percentage,
						radius: radius_scale(d.value),
						charge: radius_scale(d.value),
						name: d.device,
						cx: Math.random() * 10,
						cy: Math.random() * 10,
						color:structure.svg.color(d.id)
					};
					nodes.push(node);
				});

				var charge = function(d) {
					return - Math.pow(d.charge, 2.0) / 8;
				};

				var force = d3.layout.force()
					.nodes(nodes)
					.size([w * 0.6, h])
					.gravity(.1)
					.charge(charge)
					.on('tick', tick)
					.start();

				structure.svg.element = d3.selectAll(graph.get()).append('svg')
					.attr('width', w)
					.attr('height', h);

				structure.svg.circle = structure.svg.element.selectAll('circle')
					.data(nodes).enter().append('circle')
					.attr('r', function(d) {
						return d.radius;
					})
					.attr('class', function(d) {
						return 'PAbubble-node device-' + d.id;
					}).style('fill', function(d) {
						return d.color;
					})
					.call(force.drag);

				function tick(e) {
					structure.svg.circle.attr('cx', function(d) {
						return d.x + (center.x - d.x) * (damper + 0.02) * e.alpha;
					}).attr('cy', function(d) {
						return d.y + (center.y - d.y) * (damper + 0.02) * e.alpha;
					})
				}

				function gravity(alpha) {
					return function(d) {
						d.y += (d.cy - d.y) * alpha;
						d.x += (d.cx - d.x) * alpha;
					}
				}

				function collide(alpha) {
					var quadtree = d3.geom.quadtree(nodes);
					return function(d) {
						var r = d.radius + radius.domain()[1] + padding,
							nx1 = d.x - r,
							nx2 = d.x + r,
							ny1 = d.y - r,
							ny2 = d.y + r;
						quadtree.visit(function(quad, x1, y1, x2, y2) {
							if(quad.point && (quad.point !== d)) {
								var x = d.x - quad.point.x,
									y = d.y - quad.point.y,
									l = Math.sqrt(x * x + y * y),
									r = d.radius + quad.point.radius + (d.color !== quad.point.color) * padding;
								if(l < r) {
									l = (l - r) / l * alpha;
									d.x -= x *= l;
									d.y -= y *= l;
									quad.point.x += x;
									quad.point.y += y;
								}
							}
							return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
						})
					}
				}

				function init_legend() {
					var legend_rect_size = 10;
					var legend_spacing = 5;

					var legend_container = structure.svg.element
						.append('g')
						.attr('class', 'legend')
						.attr('height', 100)
						.attr('width', 50)
						.attr('transform', 'translate(0, 40)');

					var legend = legend_container.selectAll('.legend')
						.data(options.data)
						.enter()
						.append('g')
						.attr('class', 'legend')
						.attr('transform', function(d, i) {
							var height = legend_rect_size + legend_spacing;
							var offset = height * structure.svg.color.domain().length / 2;
							var vert = i * height - offset + 10;
							return 'translate(' + 150 + ',' + vert + ')';
						});

					legend.append('text')
						.attr('opacity', 0)
						.transition()
						.duration(500)
						.delay(1000)
						.attr('opacity', 1)
						.attr('x', -23)
						.attr('y', 9)
						.style('text', 'align-right')
						.text(function(d) {
							return d.percentage + '%';
						});

					legend.append('circle')
						.attr('opacity', 0)
						.transition()
						.duration(500)
						.delay(1000)
						.attr('cx', legend_spacing)
						.attr('cy', 5)
						.attr('r', 5)
						.attr('opacity', 1)
						.style('fill', function(d, i) {
							return structure.svg.color(i);
						})
						.style('stroke', function(d, i) {
							return structure.svg.color(i);
						});

					legend.append('text')
						.attr('opacity', 0)
						.transition()
						.duration(500)
						.delay(1000)
						.attr('opacity', 1)
						.attr('x', 15)
						.attr('y', 9)
						.text(function(d) {
							return d.device;
						});

				}

				init_legend();

			}
		};

		CHART.init(options.data);
	};

	// counter
	$.fn.PAcounter = function( options ) {

		// default options
		var settings = $.extend(true, {
			main: {
				value: 0,
				format: {
					decimals: 0
				}
			},
			secondary: {
				value:null,
				format: {
					decimals:0
				},
				description:null
			},
			diff: {
				value: null,
				format: {
					decimals: 0
				},
				description:null
			},
			icon: null
		}, options );

		var graph = this;

		graph.addClass('PAcounterContainer PAinactive');

		// clean data
		graph.find('.PAicon, .PAmain, .PAcompare .PAsecondary').remove();

		if(settings.icon) {
			var iconCounter = $('<span></span>').addClass('PAicon');
		}

		var mainCounter = $('<span></span>').attr('data-value', settings.main.value)
			.attr('data-type', 'main')
			.text(settings.main.value)
			.addClass('PAmain PAcount');

		var counterContainer;
		var secondaryContainer;

		if(settings.secondary.value || settings.secondary.description) {
			counterContainer = $('<div></div>')
				.addClass('PAcount PAcounterContainer PAcontainer');

			secondaryContainer = $('<div></div>')
				.addClass('PAcount PAsecondary PAcontainer');

			var secondaryCounter = $('<span></span>').attr('data-value', settings.secondary.value)
				.attr('data-type', 'secondary')
				.text(settings.secondary.value)
				.addClass('PAcount PAsecondary')
				.toggleClass('PAnegative', settings.secondary.value < 0)
				.toggleClass('PAnull', settings.secondary.value === 0);

			var secondaryDescription = $('<p></p>')
				.text(settings.secondary.description)
				.addClass('PAdescription PAsecondary');

			if(!!iconCounter) graph.append(iconCounter);
			graph.append(counterContainer);
			counterContainer.append(mainCounter);
			counterContainer.append(secondaryContainer);
			if(settings.secondary.value || settings.secondary.value === 0) secondaryContainer.append(secondaryCounter);
			if(settings.secondary.description) secondaryContainer.append(secondaryDescription);
		} else {
			var mainContainer = $('<div></div>')
				.addClass('PAcount PAmainContainer PAcontainer');

			graph.append(mainContainer);
			var diffDescription = null;

			if(!!settings.diff.format.after && !settings.diff.value) {
				diffDescription = $('<div></div>')
					.html(settings.diff.format.after)
					.addClass('PAdescription description');
			}

			if(!!iconCounter) mainContainer.append(iconCounter);

			mainContainer.append(mainCounter);

			if(!!diffDescription) {
				mainContainer.append(diffDescription);
			}
		}

		if(settings.icon) {
			var img = $('<img src="'+ settings.icon +'" />');
			img.load(function() {
				iconCounter.append(img);
				animateNumber(graph.find('span.PAmain'), 1000);
				animateNumber(graph.find('span.PAsecondary'), 1000);
				animateNumber(graph.next(), 1000);
				graph.removeClass('PAinactive');
			});
		} else {
			animateNumber(graph.find('span.PAmain'), 1000);
			animateNumber(graph.find('span.PAsecondary'), 1000);
			animateNumber(graph.next(), 1000);
			graph.removeClass('PAinactive');
		}

		if (settings.diff.value || settings.diff.value === 0) {

			var compareCounter;

			if(!!settings.diff.description) {
				var compare_container = $('<div></div>')
					.addClass('PAcompareContainer');

				secondaryContainer.append(compare_container);

				compareCounter = $('<span></span>').attr('data-value', settings.diff.value)
					.attr('data-type', 'diff')
					.html(settings.diff.value + settings.diff.format.after + ' ')
					.addClass('PAcompare PAcount')
					.toggleClass('PAnegative', settings.diff.value < 0)
					.toggleClass('PAnull', settings.diff.value === 0);


				var compare_description = $('<span></span>')
					.addClass('PAcompare_description')
					.text(settings.diff.description);

				compare_container.append(compareCounter);
				compare_container.append(compare_description);
			} else {
				compareCounter = $('<span></span>').attr('data-value', settings.diff.value)
					.attr('data-type', 'diff')
					.text(settings.diff.value)
					.addClass('PAcompare PAcount')
					.toggleClass('PAnegative', settings.diff.value < 0)
					.toggleClass('PAnull', settings.diff.value === 0);
				graph.after(compareCounter)
			}
		}

		function animateNumber(selector, time) {

			selector.each(function () {

				if (isNaN($(this).attr('data-value'))) { $(this).text($(this).attr('data-value')); }
				else {

					var el = $(this).text('0');

					// backup
					var timer = setTimeout(function(){ el.html( formatNumber(el.attr('data-value')*1, el.attr('data-type')) ); }, time+10);

					$({ c:0 }).animate({ c: el.attr('data-value') }, {
						duration: time,
						step: function () {
							var v = this.c;
							if (v == el.attr('data-value')) { clearInterval(timer); }
							el.html(formatNumber(v, el.attr('data-type')));
						}
					});

				}

			});

		}

		function formatNumber(number, type) {

			if(type === undefined) {
				return Number(number).format(settings.main.format);
			} else {
				return Number(number).format(settings[type].format);
			}
		}
		return graph;
	};
	
	// counter
	$.fn.PAcounterSimple = function( number, options ) {

		var num = (typeof number == 'number') ? number : 0;
		if (typeof number == 'object') { options = number; }

		// default options
		var settings = $.extend(true, {
			number: num,
			format: {
				decimals: 0
			},
			duration: 1000
		}, options );

		var graph = this;

		var previous = Number(graph.attr('data-value')) || 0;
		graph
			.attr('data-value', settings.number)
			.removeClass('positive negative');
		graph.html(Number(previous).format(settings.format))
		if (settings.number > 0) {
			graph.addClass('positive');
		}
		if (settings.number < 0) {
			graph.addClass('negative');
		}
		
		// backup
		var timer = setTimeout(function(){ graph.html(Number(settings.number).format(settings.format)); }, settings.duration+10);

		$({ c:previous }).animate({ c: Number(settings.number) }, {
			duration: settings.duration,
			step: function () {
				var v = this.c;
				if (v == Number(settings.number)) { clearInterval(timer); }
				graph.html(Number(v).format(settings.format));
			}
		});
		
		return graph;
	};

	// custom
	$.fn.PAcustom = function( options ) {

		// default options
		var settings = $.extend(true, {
			mode: 'horizontal_bar',
			data: [],
			main: {
				color: '#88b8c4',
				format: null
			},
			compare: {
				color: '#808f96',
				format: null
			}
		}, options );

		var graph = this;

		graph.addClass('PAcustomContainer');

		var MODE = {

			// classic horizontal bar graph
			horizontal_bar: {

				init: function() {

					var self = this;

					graph.addClass('PACustomHBars');
					
					var colors = (settings.main.color instanceof Array) ? settings.main.color : [settings.main.color];

					var ul = graph.find('ul').length ? d3.selectAll(graph.get()).select('ul') : d3.selectAll(graph.get()).append('ul');

					// params to zoom on the data
					var max = getMaxValues(settings.data);
					var coeff = Math.abs(max - getMinValues(settings.data));
					
					// remove exceding li
					if (settings.data.length) {
						graph.find('ul li:gt('+ (settings.data.length-1) +')').remove();
					} else {
						graph.find('ul li').remove();
					}
					
					// zoomParams
					var zoomStart = max / coeff;

					var lis = ul.selectAll('li');
					for (var i in settings.data) {
						
						var v = settings.data[i].value;
						if (v instanceof Object) {
							var t = 0;
							$.each(v,function(i,e) { t += e });
							v = t;
						}
						
						var li = lis[0][i] ? d3.select(lis[0][i]) : ul.append('li');
						var val = coeff ? 10 + zoomStart + (v - (max - coeff)) * (( 90 - zoomStart - 10 )/coeff) : 100;

						if (lis[0][i]) {

							li.select('label').text(settings.data[i].label);
							li.select('div > span').attr('data-perc', val);
							li.select('span.v').attr('data-value', v);

						} else {

							// label
							li.append('label')
								.text(settings.data[i].label);

							// bar
							li.append('div').append('span')
								.attr('data-perc', val)
								.style('background', colors[0])

							// value
							li.append('span').classed('v', true)
								.html(Number(0).format(settings.main.format))
								.attr('data-value', v);

						}
						
						if (settings.data[i].value instanceof Object) {
							var span = li.select('span[data-perc]');
							span.select('span.container').remove();
							var container = span.append('span').classed('container',true);
							var remain = 100;
							var innerSpan = null;
							var x = 1;
							$.each(settings.data[i].value, function(key,value) {
								var perc = parseInt(value / v * 100);
								var color = (typeof colors[x] == 'undefined') ? getRandomColor() : colors[x];
								remain = remain - perc;
								span.attr('data-'+key, value)
								innerSpan = 	container.append('span')
										.attr('data-perc', perc)
										.attr('data-key', key)
										.style('background', color)
								x++;
							})
							// fix rounding in percentage
							if (remain > 0) {
								innerSpan.attr('data-perc', parseInt(innerSpan.attr('data-perc'))+remain);
							}
						}

					}

					setTimeout(function() {
						self.animate();
					}, 100);
				},

				animate: function() {

					graph.find('span[data-perc]').each(function() {
						$(this).width(parseInt($(this).attr('data-perc'))+'%')
					})

					animateNumber(graph.find('span[data-value]'), 1000, settings.main.format, 100, true);

				}

			},

			gender_distribution_counters: {
				female_icon: '<svg viewBox="0 0 58 58"><g fill="none"><rect fill="#808F96" x="0" y="0" width="58" height="58" rx="40"></rect><circle stroke="#FFFFFF" stroke-width="2" cx="29" cy="29" r="26.88"></circle><path d="M34.52496,40.79136 C34.49584,40.46992 34.47456,39.9536 34.45776,39.41824 C39.32416,38.91984 42.73792,37.7528 42.73792,36.39312 C42.72448,36.39088 42.7256,36.33712 42.7256,36.31472 C39.08784,33.03648 45.87952,9.73936 33.23584,10.212 C32.44176,9.54 31.05184,8.94304 29.05824,8.94304 C11.93232,10.23888 19.50464,32.23904 15.60256,36.392 C15.60032,36.39312 15.59696,36.39312 15.59472,36.39312 C15.59472,36.39536 15.59584,36.3976 15.59584,36.39984 C15.59584,36.40096 15.59472,36.40208 15.59472,36.40208 C15.59472,36.40208 15.59584,36.40208 15.59696,36.4032 C15.61264,37.73488 18.91104,38.88064 23.63632,39.39136 C23.62288,39.71616 23.59488,40.11824 23.53328,40.79136 C22.09744,44.652 14.62032,44.89392 10.4752,48.7344 C12.74096,50.71232 20.63584,56.02336 29.10528,56.02336 C37.57472,56.02336 44.60832,52.00368 47.4128,48.6224 C43.25872,44.89056 35.94624,44.61392 34.52496,40.79136 L34.52496,40.79136 Z" fill="#FFFFFF"></path></g></svg>',
				male_icon: '<svg viewBox="0 0 58 58"><g fill="none"><rect fill="#88b8c4" x="0" y="0" width="58" height="58" rx="40"></rect><circle stroke="#FFFFFF" stroke-width="2" cx="29" cy="29" r="26.88"></circle><path d="M34.52496,40.79136 C34.36144,38.98592 34.42416,37.72592 34.42416,36.07616 C35.24176,35.6472 36.70672,32.91216 36.95424,30.6016 C37.59712,30.54896 38.61072,29.92176 38.90752,27.44544 C39.06768,26.116 38.43152,25.36784 38.044,25.13264 C39.09008,21.98656 41.26288,12.25376 34.02544,11.248 C33.28064,9.93984 31.37328,9.27792 28.89472,9.27792 C18.97824,9.46048 17.78208,16.76624 19.956,25.13264 C19.5696,25.36784 18.93344,26.116 19.09248,27.44544 C19.3904,29.92176 20.40288,30.54896 21.04576,30.6016 C21.29216,32.91104 22.81536,35.6472 23.6352,36.07616 C23.6352,37.72592 23.6968,38.98592 23.53328,40.79136 C22.12096,44.58816 14.86784,44.88496 10.68352,48.54624 C15.05824,52.9512 22.14784,56.10176 29.62944,56.10176 C37.11104,56.10176 45.90528,50.19488 47.36912,48.5832 C43.21056,44.88832 35.94064,44.6016 34.52496,40.79136 L34.52496,40.79136 Z" fill="#FFFFFF"></path></g></svg>',

				init: function() {

					var self = this;
					graph.addClass('PACustomGenderCounter');

					self.structure();

				},

				structure:function() {
					var self = this;

					var dataContainer = d3.selectAll(graph.get()).append('div')
						.classed('PAdata', true);

					var pMale = dataContainer.append('p');
					pMale.html(self.male_icon)
						.append('span')
						.attr('data-value', 0)
						.html(Number(0).format(settings.main.format));

					var pFemale = dataContainer.append('p');
					pFemale.html(self.female_icon)
						.append('span')
						.attr('data-value', 0)
						.html(Number(0).format(settings.compare.format));

					pMale.select('rect').style('fill', settings.main.color);
					pFemale.select('rect').style('fill', settings.compare.color);
				},

				animate:function(data) {
					graph.find('div.PAdata p:eq(0) > span').attr('data-value', data[0].value);
					graph.find('div.PAdata p:eq(1) > span').attr('data-value', data[1].value);

					animateNumber(graph.find('span[data-value]'), 1000, settings.main.format, 100, true);
				}
			},

			gender_distribution_v1: {

				female_icon: '<svg viewBox="0 0 58 58"><g fill="none"><rect fill="#808F96" x="0" y="0" width="58" height="58" rx="40"></rect><circle stroke="#FFFFFF" stroke-width="2" cx="29" cy="29" r="26.88"></circle><path d="M34.52496,40.79136 C34.49584,40.46992 34.47456,39.9536 34.45776,39.41824 C39.32416,38.91984 42.73792,37.7528 42.73792,36.39312 C42.72448,36.39088 42.7256,36.33712 42.7256,36.31472 C39.08784,33.03648 45.87952,9.73936 33.23584,10.212 C32.44176,9.54 31.05184,8.94304 29.05824,8.94304 C11.93232,10.23888 19.50464,32.23904 15.60256,36.392 C15.60032,36.39312 15.59696,36.39312 15.59472,36.39312 C15.59472,36.39536 15.59584,36.3976 15.59584,36.39984 C15.59584,36.40096 15.59472,36.40208 15.59472,36.40208 C15.59472,36.40208 15.59584,36.40208 15.59696,36.4032 C15.61264,37.73488 18.91104,38.88064 23.63632,39.39136 C23.62288,39.71616 23.59488,40.11824 23.53328,40.79136 C22.09744,44.652 14.62032,44.89392 10.4752,48.7344 C12.74096,50.71232 20.63584,56.02336 29.10528,56.02336 C37.57472,56.02336 44.60832,52.00368 47.4128,48.6224 C43.25872,44.89056 35.94624,44.61392 34.52496,40.79136 L34.52496,40.79136 Z" fill="#FFFFFF"></path></g></svg>',
				male_icon: '<svg viewBox="0 0 58 58"><g fill="none"><rect fill="#88b8c4" x="0" y="0" width="58" height="58" rx="40"></rect><circle stroke="#FFFFFF" stroke-width="2" cx="29" cy="29" r="26.88"></circle><path d="M34.52496,40.79136 C34.36144,38.98592 34.42416,37.72592 34.42416,36.07616 C35.24176,35.6472 36.70672,32.91216 36.95424,30.6016 C37.59712,30.54896 38.61072,29.92176 38.90752,27.44544 C39.06768,26.116 38.43152,25.36784 38.044,25.13264 C39.09008,21.98656 41.26288,12.25376 34.02544,11.248 C33.28064,9.93984 31.37328,9.27792 28.89472,9.27792 C18.97824,9.46048 17.78208,16.76624 19.956,25.13264 C19.5696,25.36784 18.93344,26.116 19.09248,27.44544 C19.3904,29.92176 20.40288,30.54896 21.04576,30.6016 C21.29216,32.91104 22.81536,35.6472 23.6352,36.07616 C23.6352,37.72592 23.6968,38.98592 23.53328,40.79136 C22.12096,44.58816 14.86784,44.88496 10.68352,48.54624 C15.05824,52.9512 22.14784,56.10176 29.62944,56.10176 C37.11104,56.10176 45.90528,50.19488 47.36912,48.5832 C43.21056,44.88832 35.94064,44.6016 34.52496,40.79136 L34.52496,40.79136 Z" fill="#FFFFFF"></path></g></svg>',
				donutContainer: null,
				donutForeground: null,

				init: function() {

					var self = this;
					
					if (!graph.hasClass('PACustomGender1')) {
						self.structure();
					} else {
						self.donutContainer = d3.selectAll(graph.get()).select('.PAdonut');
						self.donutForeground = d3.selectAll(graph.get()).select('.PAdonutForeground');
					}

					setTimeout(function() {
						self.animate(settings.data);
					}, 100);

				},

				structure: function() {

					var self = this;
					graph.addClass('PACustomGender1');

					self.donutContainer = d3.selectAll(graph.get()).append('div')
						.classed('PAdonut', true);
					var dataContainer = d3.selectAll(graph.get()).append('div')
						.classed('PAdata', true);
					// male
					var pMale = dataContainer.append('p')
					pMale.html(self.male_icon)
						.append('span')
						.attr('data-value', 0)
						.html(Number(0).format(settings.main.format));
					$(pMale[0]).find('span[data-value]')	
							.after($('<span>').addClass('PAlabel').text(''));

					// female
					var pFemale = dataContainer.append('p')
					pFemale.html(self.female_icon)
						.append('span')
						.attr('data-value', 0)
						.html(Number(0).format(settings.compare.format));
					$(pFemale[0]).find('span[data-value]')	
							.after($('<span>').addClass('PAlabel').text(''));

					pMale.select('rect').style('fill', settings.main.color);
					pFemale.select('rect').style('fill', settings.compare.color);

					var stroke = 10;
					var h = $(self.donutContainer[0]).height();

					// donut
					var τ = 2 * Math.PI;
					var arc = d3.svg.arc()
						.innerRadius(h / 2)
						.outerRadius(h / 2)
						.startAngle(0);
					var svg = self.donutContainer.append("svg")
						.attr("width", h+(stroke*2))
						.attr("height", h+(stroke*2))
						.append("g")
						.attr('width', h)
						.attr('height', h)
						.attr("transform", "translate(" + ((h/2)+stroke) + "," + ((h/2)+stroke) + ")")

					var background = svg.append("path")
						.datum({endAngle: τ})
						.style('stroke', settings.main.color)
						.style('stroke-width', stroke)
						.attr("d", arc)

					// Add the foreground arc in orange, currently showing 12.7%.
					self.donutForeground = svg.append("path")
						.classed('PAdonutForeground', true)
						.datum({endAngle: 0 })
						.style('stroke', settings.compare.color)
						.style('stroke-width', stroke)
						.style('opacity', 0)
						.style('stroke-linejoin', 'round')
						.attr("d", arc);

				},

				animate: function(data) {

					var self = this;
										
					graph.find('div.PAdata p:eq(0) > span[data-value]').attr('data-value', data[0].value || 0)
					graph.find('div.PAdata p:eq(0) > span.PAlabel').text(data[0].label)
					graph.find('div.PAdata p:eq(1) > span[data-value]').attr('data-value', data[1].value || 0)
					graph.find('div.PAdata p:eq(1) > span.PAlabel').text(data[1].label)

					animateNumber(graph.find('span[data-value]'), 1000, settings.main.format, 100, true);

					var h = $(self.donutContainer[0]).height();

					var τ = 2 * Math.PI;
					var arc = d3.svg.arc()
						.innerRadius(h / 2)
						.outerRadius(h / 2)
						.startAngle(0);

					self.donutForeground.style('opacity', 1)
						.transition()
						.duration(1000)
						.call(arcTween, data[1].value / 100 * τ);

					// see http://bl.ocks.org/mbostock/5100636
					function arcTween(transition, newAngle) {
						transition.attrTween("d", function(d) {
							var interpolate = d3.interpolate(d.endAngle, newAngle);
							return function(t) {
								d.endAngle = interpolate(t);
								return arc(d);
							};
						});
					}

				}



			},

			age_distribution: {

				male_icon: '<svg viewBox="0 0 17 15"><path d="M14.0801524,14.4567109 C15.7050178,12.9316006 16.7199993,10.764331 16.7199993,8.35999966 C16.7199993,3.74289934 12.9771,0 8.35999966,0 C3.74289934,0 0,3.74289934 0,8.35999966 C0,10.7678635 1.01796621,12.9379685 2.64701267,14.4634289 C2.65246531,14.4552179 2.65791339,14.4471119 2.66335656,14.4391127 C3.96472984,13.3004111 6.22053641,13.2081028 6.65978473,12.0272528 C6.71064139,11.4657395 6.69148306,11.0738645 6.69148306,10.5607696 C6.43650307,10.4273579 5.96276976,9.57637961 5.88613642,8.8581163 C5.6861931,8.84174464 5.37129978,8.64667798 5.27864312,7.87651301 C5.22917979,7.46304136 5.42703311,7.2303547 5.54720811,7.15720471 C4.87109313,4.55515481 5.24311312,2.28297657 8.32725632,2.22619824 C9.09811796,2.22619824 9.6913296,2.43206323 9.92297126,2.83891655 C12.1739012,3.15171987 11.4981345,6.17873641 11.1727912,7.15720471 C11.2933145,7.2303547 11.4911679,7.46304136 11.4413562,7.87651301 C11.3490479,8.64667798 11.0338062,8.84174464 10.8338629,8.8581163 C10.7568812,9.57672794 10.3012612,10.4273579 10.0469779,10.5607696 C10.0469779,11.0738645 10.0274713,11.4657395 10.0783279,12.0272528 C10.5186212,13.2122828 12.7796528,13.3014561 14.0730144,14.4506077 C14.0753917,14.4526194 14.077771,14.4546538 14.0801524,14.4567109 Z"></path></svg>',
				female_icon: '<svg viewBox="0 0 17 15"><path d="M14.0799816,14.4559844 C15.7049466,12.9309593 16.7199993,10.7637549 16.7199993,8.35948679 C16.7199993,3.74266972 12.9771,0 8.35999966,0 C3.74289934,0 0,3.74266972 0,8.35948679 C0,10.7645778 1.0157477,12.9324428 2.64168654,14.4575501 C3.93892102,13.3005812 6.21815684,13.2138769 6.65978473,12.026515 C6.67894306,11.8171795 6.68765139,11.6921355 6.69183139,11.5911251 C5.22221312,11.4322948 4.19637149,11.0759717 4.19323649,10.6583457 C5.40682978,9.36680495 3.05174821,2.52491332 8.37811299,2.1219164 C8.9981463,2.1219164 9.43042795,2.30756667 9.67739627,2.51655384 C13.6097311,2.36956619 11.4974379,9.61480306 12.6326561,10.658694 C12.6326561,11.0815447 11.5709362,11.4444857 10.0574279,11.5994845 C10.0626529,11.7659777 10.0692713,11.9265495 10.0783279,12.026515 C10.5196091,13.2132765 12.7868802,13.3010401 14.0799816,14.4559844 Z"></path></svg>',

				init: function() {

					var self = this;

					graph.addClass('PACustomAgeDist');

					var ul = d3.selectAll(graph.get()).append('ul');

					// detail male/female data
					var detail = d3.selectAll(graph.get()).append('div').classed('PAdetail hide', true);
					var detailM = detail.append('p').classed('PAmale', true).html(self.male_icon).style('color', settings.main.color);
					var datailMT = detailM.append('label')
					var detailF = detail.append('p').classed('PAfemale', true).html(self.female_icon).style('color', settings.compare.color);
					var detailFT = detailF.append('label')

					// params to zoom on the data
					var max = 0, min = 100;
					for (var i in settings.data) {
						var v = settings.data[i].value.m + settings.data[i].value.f;
						max = v > max ? v : max;
						min = v < min ? v : min;
					}
					var coeff = Math.abs(max - min) / 50;

					for (var i in settings.data) {

						var li = ul.append('li')
							.attr('data-male', settings.data[i].value.m)
							.attr('data-female', settings.data[i].value.f)
						var perc = settings.data[i].value.m + settings.data[i].value.f;
						if (perc > 0) {

							// label
							li.append('label')
								.text(settings.data[i].label)

							// bar
							var bar  = li.append('div').append('span')
								.attr('data-perc', perc / coeff)
								.style('background', settings.main.color)

							// female bar
							var percf = settings.data[i].value.f / (perc);
							bar.append('span')
								.classed('PAhide', true)
								.attr('data-perc', percf * 100)
								.style('background', settings.compare.color)

							// value
							li.append('span').html(Number(perc).format(settings.main.format))
								.attr('data-value', perc);

						}

					}

					graph.on('click', 'li', function() {

						var fbar = $(this).find('span > span');
						graph.find('li span > span').not(fbar).addClass('PAhide');
						fbar.toggleClass('PAhide');

						graph.find('div.PAdetail').toggleClass('hide', graph.find('li span > span:not(.PAhide)').length === 0)

						var m = $(this).attr('data-male') * 1
						var f = $(this).attr('data-female') * 1
						var percm = m / (m+f) * 100;

						datailMT.attr('data-value', percm);
						detailFT.attr('data-value', 100 - percm);

						animateNumber(graph.find('div.PAdetail label[data-value]'), 1000, settings.main.format, null , true);

					})

				},

				animate: function(data) {

					// params to zoom on the data
					var max = 0, min = 100;
					for (var i in data) {
						var v = data[i].value.m + data[i].value.f;
						max = v > max ? v : max;
						min = v < min ? v : min;
					}
					var coeff = Math.abs(max - min) / 50;

					// hide unused rows
					d3.selectAll(graph.get()).selectAll('li:nth-child(n+'+ parseInt(data.length+1) +')')
						.transition()
						.duration(300)
						.style('opacity', '0')
						.delay(300)
						.remove();

					var lis = d3.selectAll(graph.get()).selectAll('ul li');

					for (var i in data) {

						var element = d3.select(lis[0][i]);
						var perc = data[i].value.m + data[i].value.f;

						// create missing rows
						if (!element[0][0]) {

							var element = d3.selectAll(graph.get()).select('ul').append('li')

							if (perc > 0) {

								// label
								element.append('label')

								// bar
								var bar  = element.append('div').append('span').style('background', settings.main.color)

								// female bar
								var percf = data[i].value.f / (data[i].value.m + data[i].value.f);
								bar.append('span')
									.classed('PAhide', true)
									.style('background', settings.compare.color)

								// value
								element.append('span').html(Number(perc).format(settings.main.format))

							}

						}

						element
							.attr('data-male', data[i].value.m)
							.attr('data-female', data[i].value.f)

						element
							.select('label').text(data[i].label);



						var percf = data[i].value.f / (perc)  * 100;
						element
							.select('div > span').attr('data-perc', perc / coeff)
							.select('span')
							.classed('PAhide', true)
							.attr('data-perc', percf)

						element
							.select('span[data-value]').attr('data-value', perc);

						graph.find('div.PAdetail').addClass('hide');


					}


					graph.find('span[data-perc]').each(function() {
						$(this).width(parseInt($(this).attr('data-perc'))+'%')
					});
					animateNumber(graph.find('span[data-value]'), 1000, settings.main.format, null, true);

				}

			},

			age_and_gender_distribution: {

				male_icon: '<svg viewBox="0 0 17 15"><path d="M14.0801524,14.4567109 C15.7050178,12.9316006 16.7199993,10.764331 16.7199993,8.35999966 C16.7199993,3.74289934 12.9771,0 8.35999966,0 C3.74289934,0 0,3.74289934 0,8.35999966 C0,10.7678635 1.01796621,12.9379685 2.64701267,14.4634289 C2.65246531,14.4552179 2.65791339,14.4471119 2.66335656,14.4391127 C3.96472984,13.3004111 6.22053641,13.2081028 6.65978473,12.0272528 C6.71064139,11.4657395 6.69148306,11.0738645 6.69148306,10.5607696 C6.43650307,10.4273579 5.96276976,9.57637961 5.88613642,8.8581163 C5.6861931,8.84174464 5.37129978,8.64667798 5.27864312,7.87651301 C5.22917979,7.46304136 5.42703311,7.2303547 5.54720811,7.15720471 C4.87109313,4.55515481 5.24311312,2.28297657 8.32725632,2.22619824 C9.09811796,2.22619824 9.6913296,2.43206323 9.92297126,2.83891655 C12.1739012,3.15171987 11.4981345,6.17873641 11.1727912,7.15720471 C11.2933145,7.2303547 11.4911679,7.46304136 11.4413562,7.87651301 C11.3490479,8.64667798 11.0338062,8.84174464 10.8338629,8.8581163 C10.7568812,9.57672794 10.3012612,10.4273579 10.0469779,10.5607696 C10.0469779,11.0738645 10.0274713,11.4657395 10.0783279,12.0272528 C10.5186212,13.2122828 12.7796528,13.3014561 14.0730144,14.4506077 C14.0753917,14.4526194 14.077771,14.4546538 14.0801524,14.4567109 Z"></path></svg>',
				female_icon: '<svg viewBox="0 0 17 15"><path d="M14.0799816,14.4559844 C15.7049466,12.9309593 16.7199993,10.7637549 16.7199993,8.35948679 C16.7199993,3.74266972 12.9771,0 8.35999966,0 C3.74289934,0 0,3.74266972 0,8.35948679 C0,10.7645778 1.0157477,12.9324428 2.64168654,14.4575501 C3.93892102,13.3005812 6.21815684,13.2138769 6.65978473,12.026515 C6.67894306,11.8171795 6.68765139,11.6921355 6.69183139,11.5911251 C5.22221312,11.4322948 4.19637149,11.0759717 4.19323649,10.6583457 C5.40682978,9.36680495 3.05174821,2.52491332 8.37811299,2.1219164 C8.9981463,2.1219164 9.43042795,2.30756667 9.67739627,2.51655384 C13.6097311,2.36956619 11.4974379,9.61480306 12.6326561,10.658694 C12.6326561,11.0815447 11.5709362,11.4444857 10.0574279,11.5994845 C10.0626529,11.7659777 10.0692713,11.9265495 10.0783279,12.026515 C10.5196091,13.2132765 12.7868802,13.3010401 14.0799816,14.4559844 Z"></path></svg>',

				init: function() {

					var self = this;

					graph.addClass('PACustomAgeDist PACustomGenderDist');

					var ul = d3.selectAll(graph.get()).append('ul');

					var dataContainer = d3.selectAll(graph.get()).append('div')
						.classed('PAdata', true);

					var pMale = dataContainer.append('p');
					pMale.html(self.male_icon)
						.append('span')
						.attr('data-value', 0)
						.html(Number(0).format(settings.main.format));

					var pFemale = dataContainer.append('p');
					pFemale.html(self.female_icon)
						.append('span')
						.attr('data-value', 0)
						.html(Number(0).format(settings.compare.format));

					pMale.select('path').style('fill', settings.main.color);
					pFemale.select('path').style('fill', settings.compare.color);


					// params to zoom on the data
					var min = 0, max = 100;
					for (var i in settings.data) {
						var v = settings.data[i].value.m + settings.data[i].value.f;
						max = v > max ? v : max;
						min = v < min ? v : min;
					}
					var coeff = Math.abs(max - min) / 50;

					for (var i in settings.data) {

						var li = ul.append('li')
							.attr('data-male', settings.data[i].value.m)
							.attr('data-female', settings.data[i].value.f)
						var perc = settings.data[i].value.m + settings.data[i].value.f;
						if (perc > 0) {

							// label
							li.append('label')
								.text(settings.data[i].label)

							// bar
							var bar  = li.append('div').append('span')
								.attr('data-perc', perc / coeff)
								.style('background', settings.main.color)

							// female bar
							var percf = settings.data[i].value.f / (perc);
							bar.append('span')
								.classed('PAhide', true)
								.attr('data-perc', percf * 100)
								.style('background', settings.compare.color)

							// value
							li.append('span').html(Number(perc).format(settings.main.format))
								.attr('data-value', perc);

						}

					}


					graph.find('li').hover(
						function() {
							var fbar = $(this).find('span > span');
							fbar.removeClass('PAhide');

							graph.find('div.PAdetail').toggleClass('hide', graph.find('li span > span:not(.PAhide)').length === 0)

							var m = $(this).attr('data-male') * 1;
							var f = $(this).attr('data-female') * 1;
							var percm = m / (m+f) * 100;

							var data = {
								m:percm,
								f:100 - percm
							};

							self.animate_gender_dist(data);

							animateNumber(graph.find('div.PAdetail label[data-value]'), 400, settings.main.format, null , true);
						},
						function() {
							var fbar = $(this).find('span > span');
							fbar.addClass('PAhide');

							graph.find('div.PAdetail').toggleClass('hide', graph.find('li span > span:not(.PAhide)').length === 0);

							var ul = $(this).closest('ul');
							var list = ul.find('li').toArray();

							var m_sum = 0;
							var f_sum = 0;

							for(var x = 0; x < list.length; x++) {
								f_sum += parseFloat(list[x].dataset.female);
								m_sum += parseFloat(list[x].dataset.male);
							}

							var percm = m_sum / (m_sum+f_sum) * 100;

							var data = {
								m:percm,
								f:100 - percm
							};

							self.animate_gender_dist(data);

							animateNumber(graph.find('div.PAdetail label[data-value]'), 400, settings.main.format, null , true);
						}
					);
				},

				animate_gender_dist:function(data) {
					graph.find('div.PAdata p:eq(0) > span').attr('data-value', data.m);
					graph.find('div.PAdata p:eq(1) > span').attr('data-value', data.f);

					animateNumber(graph.find('span[data-value]'), 300, settings.main.format, 100, true);
				},

				animate: function(data) {

					var f_sum = 0;
					var m_sum = 0;
					var sum = 0;
					for(var x = 0; x < data.length; x++) {
						f_sum += data[x].value.f;
						m_sum += data[x].value.m;
						sum += data[x].value.m;
						sum += data[x].value.f;
					}

					var f_percentage = (f_sum / sum) * 100;

					graph.find('div.PAdata p:eq(0) > span').attr('data-value', 100 - f_percentage);
					graph.find('div.PAdata p:eq(1) > span').attr('data-value', f_percentage);

					animateNumber(graph.find('span[data-value]'), 1000, settings.main.format, 100, true);

					// params to zoom on the data
					var max = 0, min = 100;
					for (var i in data) {
						var v = data[i].value.m + data[i].value.f;
						max = v > max ? v : max;
						min = v < min ? v : min;
					}
					var coeff = Math.abs(max - min) / 50;

					// hide unused rows
					d3.selectAll(graph.get()).selectAll('li:nth-child(n+'+ parseInt(data.length+1) +')')
						.transition()
						.duration(300)
						.style('opacity', '0')
						.delay(300)
						.remove();

					var lis = d3.selectAll(graph.get()).selectAll('ul li');

					for (var i in data) {

						var element = d3.select(lis[0][i]);
						var perc = data[i].value.m + data[i].value.f;

						// create missing rows
						if (!element[0][0]) {

							var element = d3.selectAll(graph.get()).select('ul').append('li')

							if (perc > 0) {

								// label
								element.append('label')

								// bar
								var bar  = element.append('div').append('span').style('background', settings.main.color)

								// female bar
								var percf = data[i].value.f / (data[i].value.m + data[i].value.f);
								bar.append('span')
									.classed('PAhide', true)
									.style('background', settings.compare.color)

								// value
								element.append('span').html(Number(perc).format(settings.main.format))

							}

						}

						element
							.attr('data-male', data[i].value.m)
							.attr('data-female', data[i].value.f)

						element
							.select('label').text(data[i].label);

						var percf = data[i].value.f / (perc) * 100 ;

						element
							.select('div > span').attr('data-perc', perc)
							.select('span')
							.classed('PAhide', true)
							.attr('data-perc', percf)

						element
							.select('span[data-value]').attr('data-value', perc);

						graph.find('div.PAdetail').addClass('hide');
					}

					graph.find('span[data-perc]').each(function() {
						$(this).width(parseInt($(this).attr('data-perc'))+'%')
					});
					animateNumber(graph.find('span[data-value]'), 1000, settings.main.format, null, true);
				}
			}
		};

		function animateNumber(selector, time, format, wait, startFromActual) {

			if (!startFromActual) {
				selector.html(Number(0).format(format));
			}

			setTimeout(function() {

				selector.each(function () {

					var el = $(this);

					var start = 0;
					if (startFromActual) {
						start = (parseFloat(el.text())) || 0;
					}


					// backup
					var timer = setTimeout(function(){ el.html( Number(el.attr('data-value')*1).format(format) ); }, time+10);

					$({ c:start}).animate({ c: el.attr('data-value') }, {
						duration: time,
						step: function () {
							var v = this.c;
							if (v == el.attr('data-value')) { clearInterval(timer); }
							el.html(Number(v).format(format));
						}
					});

				});

			}, wait || 1);


		}

		MODE[settings.mode].init();

		graph.animate = function(data) {
			MODE[settings.mode].animate(data);
		};

		return graph;

	};

	function getMaxValues(data, k) {
		if (k == undefined) { k = 'value'; }
		return Math.max.apply( null, Object.keys( data ).map(function (key) { 
			var t = data[key][k];
			if (t instanceof Object) {
				var p = 0; $.each(t,function(i,e) { p += e }); t = p;
			} 
			return t;	
		}));
	}

	function getMinValues(data, k) {
		if (k == undefined) { k = 'value'; }
		return Math.min.apply( null, Object.keys( data ).map(function (key) {
			var t = data[key][k];
			if (t instanceof Object) {
				var p = 0; $.each(t,function(i,e) { p += e }); t = p;
			} 
			return t;	
		}));
	}

	function getSumValues(data, k) {
		if (k == undefined) { k = 'value'; }
		var r = 0; for (var i in data) { r += data[i][k]; }
		return r;
	}
	
	function getRandomColor() {
		return '#'+(Math.random()*0xFFFFFF<<0).toString(16);
	}
	
}( jQuery ));

String.prototype.capitalizeFirstLetter = function() { return this.charAt(0).toUpperCase() + this.slice(1); }

// Format number
// start from http://stackoverflow.com/questions/149055/how-can-i-format-numbers-as-money-in-javascript
Number.prototype.format = function(settings) {
	if (!settings) { return this.valueOf(); }
	
	var number = parseFloat(this.valueOf());
	var after = (settings.after || '');
	
	function nFormatter(num) {
	  var si = [
	    { value: 1E18, symbol: "E" },
	    { value: 1E15, symbol: "P" },
	    { value: 1E12, symbol: "T" },
	    { value: 1E9,  symbol: "G" },
	    { value: 1E6,  symbol: "M" },
	    { value: 1E3,  symbol: "k" }
	  ], i;
	  for (i = 0; i < si.length; i++) {
	    if (num >= si[i].value) {
	      return {
		      number: parseFloat((num / si[i].value).toFixed(10).replace(/\.0+$|(\.[0-9]*[1-9])0+$/, "$1")),
		      symbol: si[i].symbol
		    }
	    }
	  }
	  return {
		  number: parseFloat(num),
		  symbol: ''
		}
	}	
	
	if (settings.trimK) {
		var nf = nFormatter(this);
		number = nf.number;
		after = nf.symbol + after
	}
		
	var re = '\\d(?=(\\d{3})+' + (settings.decimals > 0 ? '\\D' : '$') + ')',
		number = number.toFixed(Math.max(0, ~~settings.decimals)),
		formatted = (settings.decimal ? number.replace('.', settings.decimal) : number).replace(new RegExp(re, 'g'), '$&' + (settings.thousand || ''));
	return (settings.before || '') + formatted + after;
}