// PAgraph Plugin
(function ($) {

	// graphics
  $.fn.PAgraph = function( options ) {
		
		// default options
    var settings = $.extend(true, {
			
			mode: 'history',
			filter: {  // only for history mode
				mode: 'daily',
				labels: ['daily', 'weekly', 'monthly']
			},
			config: {
				graph: [{
					color: '#88B8C4',
					legend: 'metric'
				}, {
					color: '#808E96',
					legend: 'compare'
				}],
				grid: {
					x: {
						show: true,
						color: '#E2E6E9',
						label: '#C1C1C1',
						openTime: false
					},
					y: {
						show: true,
						color: '#C6CED3',
						label: '#C1C1C1'
					}
				}
			},
			lineInterpolation: 'cardinal',
			preFetch: null,
						
		}, options );
		
		var graph = this;
		graph.addClass('PAgraphContainer');
		
		var structure = {
			legend: null,
			tooltip: null,
			data: [null,null],
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
					elements: []
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
															}
		
		var internalSettings = {
			
			labels: {
				x: {
					height: 30,
					marginTop: 15,
					openTime: 20
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
																								 .classed('PAtooltip', true)
																								 
		structure.tooltip.append('span').text('3123');
		structure.tooltip.append('label').text('metric');	 
		
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
																										

		var MODE = {
			
			history: {
			
				filter: 'daily', // daily, weekly, monthly 
				computedData: [null,null],
								
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
					self.initGraph();
					
				},
				
				/* INIT */
				// create empty grid without label
				initGridX: function() {
					
					var self = this;
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					var elementsCount = 8;
					
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }
					
					var spacing = Math.floor(w / (elementsCount-1) );
					structure.svg.grid.x.group = structure.svg.grid.group.append('g').classed('PAGgridX', true);
					
					for (i = 0; i < elementsCount; i++) {
						
						var x = (i * spacing)	+ j;
						
						var line =  structure.svg.grid.x.group.append('line')
																									.attr('x1', x).attr('y1', 0)
																									.attr('x2', x).attr('y2', h)
																									.attr('stroke', settings.config.grid.x.color)
						structure.svg.grid.x.elements.push(line);
						
					}					
					
				},
				
				initGridY: function() {
					var self = this;
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }
					
					var elementsCount = 6;
					
					var spacing = Math.floor(h / elementsCount);
					structure.svg.grid.y.group = structure.svg.grid.group.append('g').classed('PAGgridY', true);		
					
					
					for (i = 0; i < elementsCount; i++) {
						
						var line =  structure.svg.grid.y.group.append('line')
																									.attr('x1', j).attr('y1', h - (i*spacing))
																									.attr('x2', graph.width()).attr('y2', h - (i*spacing))
																									.attr('stroke', settings.config.grid.y.color)
						structure.svg.grid.y.elements.push(line);
														
					}
					
				},
			
				// create flat graph
				initGraph: function() {
					
					var self = this;
										
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					var graphElements = $.extend(true, {}, graphElementsEmpty);
					
					graphElements.group = structure.svg.graph.group.insert('g',':first-child')
																							 					 .classed('PAGgraph', true)
					structure.svg.graph.elements.push(graphElements);
										
					var index = structure.svg.graph.elements.length - 1;
					structure.svg.graph.elements[index].group.attr('data-index', index);
					
					var elementsCount = structure.svg.grid.x.elements.length || 8;

					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; }
					var spacing = Math.floor(w / (elementsCount-1) );

					var lineData = [];
					for (i = 0; i < elementsCount; i++) {
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
											    											 .attr('fill', 'none')
					structure.svg.graph.elements[index].elements.line = lineG;

			    var areaG = structure.svg.graph.elements[index].group.append('path')
											    											 .classed('PAGgraphArea', true)
											    											 .attr('d', pathCoord)
											    											 .attr('stroke-width', 0)
											    											 .attr('fill', settings.config.graph[index].color)
					structure.svg.graph.elements[index].elements.area = areaG;
					
					// add label to legend
					var p = structure.legend.append('p')
																	.attr('data-index', index)
					p.append('span')
					 .style('background', settings.config.graph[index].color);
					p.append('label')
					 .text(settings.config.graph[index].legend);
					
										
					return index;

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
						.on('click', 'p[data-mode]', function() {

							// control values
							settings.filter.mode = $(this).attr('data-mode');
							self.applyFilter();
														
						})
					
				},
				
				/* ANIMATE */				
				// animate main graph
				mainGraph: function(data) {
					
					var self = this;
					var index = 0;
					
					if (data == undefined) { var data = structure.data[0]; } else { structure.data[0] = data; }
					if (data.length == 0) return;
					
					// show filters based on elements number
					structure.filters.classed('PAhide', true);
					if (structure.data[0].length >= 28) {

						if (structure.data[0].length > 40 && settings.filter.mode == 'daily') { settings.filter.mode = 'weekly'; }
						structure.filters.select('p[data-mode="daily"]').classed('PAhide', (structure.data[0].length > 60));
						structure.filters.select('p[data-mode="monthly"]').classed('PAhide', (structure.data[0].length < 120));

						structure.filters.selectAll('p').classed('selected', false);
						structure.filters.select('p[data-mode="'+settings.filter.mode+'"]').classed('selected', true);

						setTimeout(function() { structure.filters.classed('PAhide', false);	}, internalSettings.animateGridTime);
					} else {
						settings.filter.mode = 'daily';
						structure.filters.selectAll('p').classed('selected', false);
						structure.filters.select('p[data-mode="'+settings.filter.mode+'"]').classed('selected', true);
					}
					
					// animate graph
					self.computedData[0] = self.applyFilterToData(data, settings.filter.mode);
					var allData = mergeAndClean(self.computedData);
					structure.svg.grid.y.spacing = Yspacing(allData);
					
					if (self.computedData[0].length != structure.svg.grid.x.elements.length) {
						if (self.computedData[1]) { self.removeCompareGraph() }
						structure.svg.grid.y.spacing = Yspacing(self.computedData[0]);
						self.flattenGraph(self.computedData[0], 0, function() {
							self.drawGraphAnimation(self.computedData[0], 0);
						})	
					} else {
						self.drawGraphAnimation(self.computedData[0], 0);
						if (self.computedData[1]) { self.drawGraphAnimation(self.computedData[1], 1); }
					}
					
				},
				
				// animate compare graph
				compareWith: function(data) {
					
					var self = this;
					
					if (data == undefined) { var data = structure.data[1]; } else { structure.data[1] = data; }
					if (data.length == 0) return;
					if (structure.data[1].length != structure.data[0].length) {
						alert('Compare metric has a different scale'); // TODO transform in console.error
						return;
					}

					var index = structure.svg.graph.elements.length == 1 ? self.initGraph() : 1;

					self.computedData[1] = self.applyFilterToData(data, settings.filter.mode);
					var allData = mergeAndClean(self.computedData);
					structure.svg.grid.y.spacing = Yspacing(allData);
					
					self.drawGraphAnimation(self.computedData[0], 0);
					self.drawGraphAnimation(self.computedData[1], 1);
					
				},
				
				applyFilter: function() {
					
					var self = this;
					
					structure.filters.selectAll('p').classed('selected', false);
					structure.filters.select('p[data-mode="'+settings.filter.mode+'"]').classed('selected', true);
					
					self.computedData[0] = self.applyFilterToData(structure.data[0], settings.filter.mode);
					self.computedData[1] = self.applyFilterToData(structure.data[1], settings.filter.mode);
										
					var allData = mergeAndClean(self.computedData);
					structure.svg.grid.y.spacing = Yspacing(allData);

					if (self.computedData[1]) { self.flattenGraph(self.computedData[1], 1); }
					self.flattenGraph(self.computedData[0], 0, function() {
						self.drawGraphAnimation(self.computedData[0], 0);
						if (self.computedData[1]) { self.drawGraphAnimation(self.computedData[1], 1); }
					})	
					
				},
				
				// flow of animation
				drawGraphAnimation: function(data, index) {
					
					var self = this;
					
					self.animateGridX(data);
					self.animateLabelY(data);
					setTimeout(function() {
						self.animateGraph(data, index);
					}, internalSettings.animateGridTime);					
					
				},
				
				// fix X grid spacing
				// add or remove lines
				animateGridX: function(data) {
					
					var self = this;
					self.animateLabelX(data);
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					var elementsCount = data.length;
										
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }
					
					var spacing = Math.floor(w / (elementsCount-1) );
					
					// fix the number of lines and animate
					// add new lines outside the artboard
					if (elementsCount > structure.svg.grid.x.elements.length) {
						var diff = elementsCount - structure.svg.grid.x.elements.length;
						for (a = 0; a < diff; a++) {
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
																						.ease(internalSettings.animateEasing)
																						
						
					}
													
					// remove the lines outside the artboard after the animation
					if (elementsCount < structure.svg.grid.x.elements.length) {
						setTimeout(function() {
							var diff = structure.svg.grid.x.elements.length - elementsCount;	
							for (a = 0; a < diff; a++) {
								
								var i = a + elementsCount;
								structure.svg.grid.x.elements[i].remove();
									
							}
							
							structure.svg.grid.x.elements.splice(elementsCount, diff);
							
						}, internalSettings.animateGridTime);
					}
										
				},
				
				// fix the number of labels and animate
				// remove the labels outside the artboard
				animateLabelX: function(data) {
					var self = this;
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					var elementsCount = data.length;

					if (settings.config.grid.x.label) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label) {  j = internalSettings.labels.y.width; w = w - j; }
					
					var spacing = Math.floor(w / (data.length-1) );
					
					// hide current labels
					structure.svg.label.x.group.classed('PAhide', true)
																		 .selectAll('text')
																		 .classed('show', false);
					
					// fix the number of labels and position
					setTimeout(function() {
						for(var i in data) {
							
							var x = (i * spacing)	+ j;
							
							if (structure.svg.label.x.elements[i]) { // move existing and update text
								
								structure.svg.label.x.elements[i].attr('x', x)
																								 .text(data[i].label)
								
							} else { // create new
							
								var label =  structure.svg.label.x.group.append('text')
																												.attr('x', x)
																												.attr('y', h+internalSettings.labels.x.marginTop)
																												.attr('text-anchor','middle')
																												.attr('fill', settings.config.grid.x.label)
																												.text(data[i].label)
								structure.svg.label.x.elements.push(label);
	
							}
							
						}
						
						// add classes to labelX group in order to hide some element when they are to thick
						
					}, internalSettings.animateGridTime);
					
					// remove exceeded
					if (elementsCount < structure.svg.label.x.elements.length) {
						var diff = structure.svg.grid.x.elements.length - elementsCount;	
						for (a = 0; a < diff; a++) {
							
							var i = a + elementsCount;
							if (structure.svg.label.x.elements[i]) { structure.svg.label.x.elements[i].remove(); }
								
						}
						
						structure.svg.label.x.elements.splice(elementsCount, diff);
					}
					
					setTimeout(function() {
						// show current labels
						self.hideThickLabels();
// 						structure.svg.label.x.group.classed('hide', false);
					}, internalSettings.animateGridTime*2)
								
				},
				
				// hide some labels when there are too much
				hideThickLabels: function() {
					
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
						l2_size = labelGroup.find('text:eq('+(l2_index)+')').position().left;
					}
					
					structure.svg.label.x.group.selectAll('text:nth-child('+nthChildX+'n+2)')
																		 .classed('show', true);
					
					
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

				// fix the number of labels and animate
				// remove the labels outside the artboard
				animateLabelY: function(data) {
					var self = this;
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					var elementsCount = data.length;

					if (settings.config.grid.x.label) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label) {  j = internalSettings.labels.y.width; w = w - j; }
					
					var elementsCount = 6;
					var spacing = Math.floor(h / elementsCount);
					
					// hide current labels
					structure.svg.label.y.group.classed('PAhide', true);
					
					// fix the number of labels and position
					setTimeout(function() {
						for (i = 0; i < elementsCount; i++) {
							
							if (structure.svg.label.y.elements[i]) { // move existing and update text

								structure.svg.label.y.elements[i].text(structure.svg.grid.y.spacing[i])

							} else {
								var label =  structure.svg.label.y.group.append('text')
																	.attr('x', 50)
																	.attr('y', h - (i*spacing))
																	.attr('text-anchor','end')
																	.attr('fill', settings.config.grid.y.label)
																	.text(structure.svg.grid.y.spacing[i])
								structure.svg.label.y.elements.push(label);
							}
															
						}
						
					}, internalSettings.animateGridTime);
										
					setTimeout(function() {
						// show current labels
						structure.svg.label.y.group.classed('PAhide', false);
					}, internalSettings.animateGridTime*2)
								
				},
				
				// animate line and area
				animateGraph: function(data, index) {
					var self = this;
					
					if (!structure.svg.graph.elements[index]) return;
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }

					var spacingX = Math.floor(w / (data.length - 1) );
					var spacingY = (Math.floor(h / 6)) / (structure.svg.grid.y.spacing[1] - structure.svg.grid.y.spacing[0]);
					
					// remove circles
					structure.svg.graph.elements[index].group.selectAll('circle').classed('PAhide', 'true');
					setTimeout(function() {
						structure.svg.graph.elements[index].group.selectAll('circle.PAhide').remove();
					}, 300);
					
					// animate line
					var lineData = [];
					for(var i in data) {
						
						var x = (i * spacingX)	+ j;
						var y = parseInt(h - ((data[i].value - structure.svg.grid.y.spacing[0])  * spacingY ));
																																																						
						lineData.push({
							'x': x,
							'y': y
						});
						
					}
					structure.svg.graph.elements[index].elements.points.coords = lineData;
					
					var lineF = d3.svg.line()
			                      .x(function(d) { return d.x; })
			                      .y(function(d) { return d.y; })
			                      .interpolate(internalSettings.graphLineInterpolation);
			    var pathCoord = lineF(lineData);
					// complete the area
					pathCoordArea = pathCoord;
					pathCoordArea += 'L'+ getMaxValues(lineData,'x') + ',' + h;
					pathCoordArea += 'L'+ j + ',' + h;
					pathCoordArea += 'L'+ j + ',' + lineData[0]['y'];
			
			    structure.svg.graph.elements[index].elements.area.transition()
												    												.duration(internalSettings.graphAnimationTime)
												    												.attr('d', pathCoordArea)
												    												.ease(internalSettings.animateEasing)
			    structure.svg.graph.elements[index].elements.line.transition()
												    												.duration(internalSettings.graphAnimationTime)
																			    					.attr('d', pathCoord)
																			    					.ease(internalSettings.animateEasing)
																			    					.each("end",function() {
																				    					self.animateCircles(data, index);
																			    					})
					
				},
				
				// animate the circles
				animateCircles: function(data, index) {
					
					var self = this;
										
					for (var i in structure.svg.graph.elements[index].elements.points.coords) {
						
						var coords = structure.svg.graph.elements[index].elements.points.coords[i];
						var circle = structure.svg.graph.elements[index].group.append('circle')
																															.attr('cx', coords.x)
																															.attr('cy', coords.y)
																															.attr('r', 0)
																															.attr('stroke-width', 2)
																															.attr('stroke', settings.config.graph[index].color)
																															.attr('fill', '#fff')
																															.attr('data-value', data[i].value)
																															.attr('data-xStep', i)
																																.transition()
																																.delay(i*20)
																																.attr('r', 4)
																																.ease(internalSettings.animateEasing)
						structure.svg.graph.elements[index].elements.points.elements.push(circle);
												
					}
					
				},
				
				// flatten graph before
				flattenGraph: function(data, index, callback) {
					
					var self = this;
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					if (!structure.svg.graph.elements[index]) {
						if (typeof callback == 'function') { callback.call(); }
						return;
					}
					
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }

					var spacingBefore = Math.floor(w / (structure.svg.grid.x.elements.length - 1) );
					var spacingNext = Math.floor(w / (data.length - 1) );

					// remove circles
					structure.svg.graph.elements[index].group.selectAll('circle').classed('PAhide', true);
					setTimeout(function() {
						structure.svg.graph.elements[index].group.selectAll('circle.PAhide').remove();
					}, 300);

					
					// create flat path with the same point number of the grid
					var lineData = [];
					for (i = 0; i < structure.svg.grid.x.elements.length; i++) {						
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
					pathCoordArea += 'L'+ j + ',' + lineData[0]['y'];
			
					if (data.length) {
						// create flat path with the new grid number of points
						var lineData = [];
						for (i = 0; i < data.length; i++) {						
							var x = (i * spacingNext)	+ j;
							lineData.push({
								'x': x,
								'y': h
							});
						}
					}
					
					var lineF = d3.svg.line()
			                      .x(function(d) { return d.x; })
			                      .y(function(d) { return d.y; })
			                      .interpolate(internalSettings.graphLineInterpolation);
			    var pathCoordNext = lineF(lineData);
					pathCoordAreaNext = pathCoordNext;
					pathCoordAreaNext += 'L'+ getMaxValues(lineData,'x') + ',' + (h+1);
					pathCoordAreaNext += 'L'+ j + ',' + (h+1);
					pathCoordAreaNext += 'L'+ j + ',' + lineData[0]['y'];


					// animate the paths
			    structure.svg.graph.elements[index].elements.area.transition()
												    												.duration(internalSettings.graphAnimationTime)
												    												.attr('d', pathCoordArea)
												    												.ease(internalSettings.animateEasing)
																			    					.each("end",function() {
																				    					structure.svg.graph.elements[index].elements.area.attr('d', pathCoordAreaNext);
																				    				});
			    structure.svg.graph.elements[index].elements.line.transition()
												    												.duration(internalSettings.graphAnimationTime)
																			    					.attr('d', pathCoord)
																			    					.ease(internalSettings.animateEasing)
																			    					.each("end",function() {
																				    					structure.svg.graph.elements[index].elements.line.attr('d', pathCoordNext);
																				    					if (typeof callback == 'function') { callback.call(); }
																			    					})
					
				},
								
				// remove last graph
				removeCompareGraph: function() {
										
					var self = this;
					self.flattenGraph([], 1, function() {
						structure.svg.graph.elements[1].group.remove();
						structure.svg.graph.elements.pop();
						graph.find('div.PAlegend > p[data-index=1]').remove()
						structure.data[1] = null;
						self.computedData[1] = null;
					});
					
				},
				
				removeCompare: function() {
				
					var self = this;

					if (structure.data[1] == null) return;
					
					self.removeCompareGraph();
					setTimeout(function() {
						self.mainGraph();
					}, internalSettings.graphAnimationTime+10);
					
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
				
				// action on circles
				initCircles: function() {
					var self = this;
					
					var displayNoneTimer = null;

					graph
						.on('mouseover', 'circle', function() {
							
							structure.tooltip.style('display', 'block');
							clearTimeout(displayNoneTimer);

							// label and value
							var index = $(this).parent('g').attr('data-index');
							
							structure.tooltip
								.style('color', settings.config.graph[index].color)
								.select('span').text($(this).attr('data-value'));

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
								
						for (i in data) {

							// first
							if (i % 7 == 0) {
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
								
						for (i in data) {

							// first
							if (i % 30 == 0) {
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
			
			weekday: {
											
				// start with a week structure
				init: function() {
					
					debug('MODE: weekday');
					
					var self = this;
					
					self.grid();
					
				},
				
				grid: function() {
					
					var self = this;
					
					self.initGridY();
					self.initGraph();
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
					
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }
					
					var elementsCount = 6;
					
					var spacing = Math.floor(h / elementsCount);
					structure.svg.grid.y.group = structure.svg.grid.group.append('g').classed('PAGgridY', true);		
					
					
					for (i = 0; i < elementsCount; i++) {
						
						var line =  structure.svg.grid.y.group.append('line')
																									.attr('x1', j).attr('y1', h - (i*spacing))
																									.attr('x2', graph.width()).attr('y2', h - (i*spacing))
																									.attr('stroke', settings.config.grid.y.color)
						structure.svg.grid.y.elements.push(line);
														
					}
					
				},
			
				// create flat graph
				initGraph: function() {
					
					var self = this;
										
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
					
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }
					var spacing = Math.floor(w/7);
					
					var rectW = Math.floor(spacing*0.7);
					var offsetX = Math.floor(spacing*0.1);

					for (i = 0; i < 7; i++) {
						
						var x = (i * spacing) + j + (spacing / 2) - (rectW / 2) + (index * offsetX);

						var rect = structure.svg.graph.elements[index].group.append('rect')
																																.attr('x', x)
																																.attr('y', h-1)
																																.attr('width', rectW)
																																.attr('height', 1)
																																.attr('rx', 5)
																																.attr('ry', 5)
																																.attr('fill', settings.config.graph[index].color)
						structure.svg.graph.elements[index].elements.area.push(rect);
						
					}					

					// add label to legend
					var p = structure.legend.append('p')
																	.attr('data-index', index)
					p.append('span')
					 .style('background', settings.config.graph[index].color);
					p.append('label')
					 .text(settings.config.graph[index].legend);
										
					return index;

				},
				
				initLabelX: function() {
					
					var self = this;
										
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }
					var spacing = Math.floor(w/7);
					
					for (i = 0; i < 7; i++) {
						
						var x = (i * spacing) + j + (spacing / 2);

						var label =  structure.svg.label.x.group.append('text')
																										.attr('x', x)
																										.attr('y', h+internalSettings.labels.x.marginTop)
																										.attr('text-anchor','middle')
																										.attr('fill', settings.config.grid.x.label)
																										.text(structure.data[0][i].label)
						structure.svg.label.x.elements.push(label);
						
					}					
					
				},
				
				/* ANIMATE */
				// animate main graph
				mainGraph: function(data) {
					
					var self = this;
					var index = 0;

					if (data == undefined) { var data = structure.data[0]; }
					if (data.length == 0) return;
					
					structure.data[0] = data;
					if (structure.svg.label.x.elements.length == 0) { self.initLabelX();	}
					var allData = mergeAndClean(structure.data);
					structure.svg.grid.y.spacing = Yspacing(allData);
					self.animateLabelY(allData);
					
					setTimeout(function() {
											
						self.animateGraph(structure.data[0], 0);
						if (structure.data[1] != null) { 	self.animateGraph(structure.data[1], 1); }
						
					}, internalSettings.animateGridTime);										
					
				},

				// animate compare graph
				compareWith: function(data) {
					
					var self = this;
					var index = (structure.svg.graph.elements.length == 1) ? self.initGraph() : 1;

					if (data == undefined) { var data = structure.data[1]; }
					if (data.length == 0) return;
					
					structure.data[1] = data;
					var allData = mergeAndClean(structure.data);
					structure.svg.grid.y.spacing = Yspacing(allData);
					self.animateLabelY(allData);

					structure.svg.graph.elements[0].group.classed('percentage', false);

					self.animateGraph(structure.data[0], 0);
					self.animateGraph(structure.data[1], 1);
					
					setTimeout(function() {
						self.initCompareValues();
					}, internalSettings.animateGridTime);										
					
				},								
				// fix the number of labels and animate
				// remove the labels outside the artboard
				animateLabelY: function(data) {
					var self = this;
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					var elementsCount = data.length;

					if (settings.config.grid.x.label) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label) {  j = internalSettings.labels.y.width; w = w - j; }
					
					var elementsCount = 6;
					var spacing = Math.floor(h / elementsCount);
					
					// hide current labels
					structure.svg.label.y.group.classed('PAhide', true);
					
					// fix the number of labels and position
					setTimeout(function() {
						for (i = 0; i < elementsCount; i++) {
							
							if (structure.svg.label.y.elements[i]) { // move existing and update text

								structure.svg.label.y.elements[i].text(structure.svg.grid.y.spacing[i])

							} else {
								var label =  structure.svg.label.y.group.append('text')
																	.attr('x', 50)
																	.attr('y', h - (i*spacing))
																	.attr('text-anchor','end')
																	.attr('fill', settings.config.grid.y.label)
																	.text(structure.svg.grid.y.spacing[i])
								structure.svg.label.y.elements.push(label);
							}
															
						}
						
					}, internalSettings.animateGridTime);
										
					setTimeout(function() {
						// show current labels
						structure.svg.label.y.group.classed('PAhide', false);
					}, internalSettings.animateGridTime*2)
								
				},
								
				// animate line and area
				animateGraph: function(data, index) {
					var self = this;
					
					var index = index || 0;
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }

					var spacingX = Math.floor(w / (data.length - 1) );
					var spacingY = (Math.floor(h / 6)) / (structure.svg.grid.y.spacing[1] - structure.svg.grid.y.spacing[0]);
					
					for (i in structure.svg.graph.elements[index].elements.area) {
						
						var y = parseInt(h - ((data[i].value - structure.svg.grid.y.spacing[0])  * spacingY ));						
						
						structure.svg.graph.elements[index].elements.area[i].transition()
																			    												.duration(internalSettings.graphAnimationTime)
																			    												.attr('y', y)
																			    												.attr('height', h-y)
																			    												.attr('data-value', data[i].value)
																			    												.ease(internalSettings.animateEasing)					
					}
										
				},								
				
				// remove last graph
				removeCompare: function() {
					
					var self = this;
					var index = 1;
				
					if (structure.data[1] == null) return;				
					
					var h = graph.height();
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }

					structure.data[index] = null;
					self.mainGraph();
					structure.svg.graph.elements[0].group.classed('percentage', false);
					
					// flatten compare
					for (i in structure.svg.graph.elements[index].elements.area) {
						
						structure.svg.graph.elements[index].elements.area[i].transition()
																			    												.duration(internalSettings.graphAnimationTime)
																			    												.attr('y', h-1)
																			    												.attr('height', 1)
																			    												.ease(internalSettings.animateEasing)
						
					}
					
					setTimeout(function() {
					
						structure.svg.graph.elements[index].group.remove();
						structure.svg.graph.elements.pop();
						graph.find('div.PAlegend > p[data-index='+index+']').remove()
					
					}, internalSettings.graphAnimationTime);

					
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
							
							structure.tooltip
								.style('color', settings.config.graph[index].color)
								.select('span').text($(this).attr('data-value'));

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
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					
					for (i in structure.data[0]) {

						var diff = structure.data[0][i].value - structure.data[1][i].value;
						var perc = Math.round(diff / structure.data[1][i].value * 100);
						
						perc = (perc > 0) ? '+'+perc+'%' : (perc == 0) ? '' : perc+'%';
						
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
			
			daytime: {
				
				iconsPath: {
					clock: 'M9.00409994,18 C6.60090949,18 4.34229601,17.064 2.64335603,15.3636429 C-0.133806833,12.5858571 -0.793720359,8.37321429 1.00224683,4.8825 C1.1648156,4.56685714 1.5516393,4.44278571 1.86778093,4.60478571 C2.18392256,4.76678571 2.30793747,5.15442857 2.1453687,5.47071429 C0.605784665,8.46257143 1.17124124,12.0728571 3.55194194,14.4546429 C5.00799262,15.912 6.94403882,16.7142857 9.00409994,16.7142857 C11.0635185,16.7142857 13.0002073,15.912 14.4562579,14.4546429 C15.9123086,12.9972857 16.7148714,11.0603571 16.7148714,9 C16.7148714,6.939 15.9129512,5.00207143 14.4562579,3.54535714 C12.9995647,2.08864286 11.0641611,1.28571429 9.00409994,1.28571429 C6.94403882,1.28571429 5.00799262,2.08864286 3.55194194,3.54535714 C3.3006993,3.79671429 2.89459867,3.79671429 2.64335603,3.54535714 C2.39211339,3.294 2.39211339,2.88771429 2.64335603,2.63635714 C4.34229601,0.936642857 6.60090949,0 9.00409994,0 C11.4072904,0 13.6665464,0.936642857 15.3648438,2.63635714 C17.0644264,4.33607143 18,6.59571429 18,9 C18,11.4036429 17.0644264,13.6639286 15.3648438,15.3636429 C13.6665464,17.064 11.4072904,18 9.00409994,18 Z M11.8392035,12.8435714 L8.26785141,9.98642857 C8.09856932,9.85071429 8,9.64571429 8,9.42857143 L8,3.71428571 C8,3.32 8.31999315,3 8.71427042,3 C9.10854769,3 9.42854084,3.32 9.42854084,3.71428571 L9.42854084,9.08571429 L12.7320415,11.7278571 C13.0398921,11.975 13.089891,12.4242857 12.8434677,12.7321429 C12.7020422,12.9078571 12.4949037,13 12.2849082,13 C12.128483,13 11.9713435,12.9492857 11.8392035,12.8435714 Z',
					open: 'M13.8953077,4.797 C14.0725385,4.797 14.2497692,4.7295 14.3847692,4.59415385 L15.3640385,3.61488462 C15.6343846,3.34453846 15.6343846,2.90630769 15.3640385,2.63596154 C15.0936923,2.36561538 14.6551154,2.36561538 14.3851154,2.63596154 L13.4058462,3.61523077 C13.1355,3.88557692 13.1355,4.32380769 13.4058462,4.59415385 C13.5408462,4.7295 13.7180769,4.797 13.8953077,4.797 L13.8953077,4.797 Z M2.76923077,9 C2.76923077,8.61784615 2.45907692,8.30769231 2.07692308,8.30769231 L0.692307692,8.30769231 C0.310153846,8.30769231 0,8.61784615 0,9 C0,9.38215385 0.310153846,9.69230769 0.692307692,9.69230769 L2.07692308,9.69230769 C2.45907692,9.69230769 2.76923077,9.38215385 2.76923077,9 L2.76923077,9 Z M3.61523077,13.4058462 L2.63596154,14.3851154 C2.36561538,14.6554615 2.36561538,15.0936923 2.63596154,15.3640385 C2.77096154,15.4993846 2.94819231,15.5668846 3.12542308,15.5668846 C3.30265385,15.5668846 3.47988462,15.4993846 3.61488462,15.3640385 L4.59415385,14.3847692 C4.8645,14.1144231 4.8645,13.6761923 4.59415385,13.4058462 C4.32415385,13.1355 3.88523077,13.1355 3.61523077,13.4058462 L3.61523077,13.4058462 Z M3.61523077,4.59415385 C3.75023077,4.7295 3.92746154,4.797 4.10469231,4.797 C4.28192308,4.797 4.45915385,4.7295 4.59415385,4.59415385 C4.8645,4.32380769 4.8645,3.88557692 4.59415385,3.61523077 L3.61488462,2.63596154 C3.34488462,2.36561538 2.90596154,2.36561538 2.63596154,2.63596154 C2.36561538,2.90630769 2.36561538,3.34453846 2.63596154,3.61488462 L3.61523077,4.59415385 L3.61523077,4.59415385 Z M9,2.76923077 C9.38215385,2.76923077 9.69230769,2.45907692 9.69230769,2.07692308 L9.69230769,0.692307692 C9.69230769,0.310153846 9.38215385,0 9,0 C8.61784615,0 8.30769231,0.310153846 8.30769231,0.692307692 L8.30769231,2.07692308 C8.30769231,2.45907692 8.61784615,2.76923077 9,2.76923077 L9,2.76923077 Z M17.3076923,8.30769231 L15.9230769,8.30769231 C15.5409231,8.30769231 15.2307692,8.61784615 15.2307692,9 C15.2307692,9.38215385 15.5409231,9.69230769 15.9230769,9.69230769 L17.3076923,9.69230769 C17.6898462,9.69230769 18,9.38215385 18,9 C18,8.61784615 17.6898462,8.30769231 17.3076923,8.30769231 L17.3076923,8.30769231 Z M14.3847692,13.4058462 C14.1147692,13.1355 13.6758462,13.1355 13.4058462,13.4058462 C13.1355,13.6761923 13.1355,14.1144231 13.4058462,14.3847692 L14.3851154,15.3640385 C14.5201154,15.4993846 14.6973462,15.5668846 14.8745769,15.5668846 C15.0518077,15.5668846 15.2286923,15.4993846 15.3640385,15.3640385 C15.6343846,15.0936923 15.6343846,14.6554615 15.3640385,14.3851154 L14.3847692,13.4058462 L14.3847692,13.4058462 Z M9,15.2307692 C8.61784615,15.2307692 8.30769231,15.5409231 8.30769231,15.9230769 L8.30769231,17.3076923 C8.30769231,17.6898462 8.61784615,18 9,18 C9.38215385,18 9.69230769,17.6898462 9.69230769,17.3076923 L9.69230769,15.9230769 C9.69230769,15.5409231 9.38215385,15.2307692 9,15.2307692 L9,15.2307692 Z M9,4.15384615 C6.32769231,4.15384615 4.15384615,6.32769231 4.15384615,9 C4.15384615,11.6723077 6.32769231,13.8461538 9,13.8461538 C11.6723077,13.8461538 13.8461538,11.6723077 13.8461538,9 C13.8461538,6.32769231 11.6723077,4.15384615 9,4.15384615 L9,4.15384615 Z M9,12.4615385 C7.09130769,12.4615385 5.53846154,10.9086923 5.53846154,9 C5.53846154,7.09130769 7.09130769,5.53846154 9,5.53846154 C10.9086923,5.53846154 12.4615385,7.09130769 12.4615385,9 C12.4615385,10.9086923 10.9086923,12.4615385 9,12.4615385 L9,12.4615385 Z',
					close: 'M20.7889655,10.1146087 C22.0026207,9.03986957 22.7586207,7.4736087 22.7586207,5.7826087 C22.7586207,5.3266087 22.3878621,4.95652174 21.9310345,4.95652174 C19.6493793,4.95652174 17.7931034,3.1036087 17.7931034,0.826086957 C17.7931034,0.370086957 17.4223448,0 16.9655172,0 C14.0366897,0 11.6147586,2.18252174 11.2315862,5.00236957 C8.39793103,5.30678261 6.04551724,7.26915217 5.25062069,9.98863043 C5.01186207,9.94567391 4.76151724,9.91304348 4.55172414,9.91304348 C2.04206897,9.91304348 0,11.951413 0,14.4565217 C0,16.9616304 2.04206897,19 4.55172414,19 L19.4482759,19 C21.957931,19 24,16.9616304 24,14.4565217 C24,12.416913 22.646069,10.6875 20.7889655,10.1146087 L20.7889655,10.1146087 Z M16.2074483,1.72156522 C16.593931,4.19363043 18.5557241,6.15269565 21.0322759,6.53930435 C20.7777931,7.88004348 19.8571034,9.02004348 18.6066207,9.56526087 C17.7153103,7.10847826 15.5251034,5.34973913 12.8995862,5.01847826 C13.2136552,3.35019565 14.5348966,2.03217391 16.2074483,1.72156522 L16.2074483,1.72156522 Z M19.4482759,17.3478261 L4.55172414,17.3478261 C2.95489655,17.3478261 1.65517241,16.0504565 1.65517241,14.4565217 C1.65517241,12.862587 2.95489655,11.5652174 4.55172414,11.5652174 C4.66634483,11.5652174 4.85131034,11.5933043 5.0457931,11.6321304 L5.0457931,12.3913043 C5.0457931,12.8473043 5.41655172,13.2173913 5.87337931,13.2173913 C6.3302069,13.2173913 6.70096552,12.8473043 6.70096552,12.3913043 L6.70096552,11.0596522 C7.1457931,8.47771739 9.36455172,6.60869565 12,6.60869565 C14.6366897,6.60869565 16.8562759,8.47978261 17.2998621,11.0641957 L17.2998621,12.3913043 C17.2998621,12.8473043 17.6706207,13.2173913 18.1274483,13.2173913 C18.5842759,13.2173913 18.9550345,12.8473043 18.9550345,12.3913043 L18.9550345,11.6325435 C19.1495172,11.5937174 19.3348966,11.5652174 19.4482759,11.5652174 C21.0451034,11.5652174 22.3448276,12.862587 22.3448276,14.4565217 C22.3448276,16.0504565 21.0451034,17.3478261 19.4482759,17.3478261 L19.4482759,17.3478261 Z'
				},
				
				openTimeElements: {
					open: {
						line: null,
						icon: null
					},
					close: {
						line: null,
						icon: null
					}
				},
				
				// start with a week structure
				init: function() {
					
					debug('MODE: daytime');
					
					var self = this;
					
					self.grid();
					
				},
				
				grid: function() {
					
					var self = this;
					
					self.initGridY();
					self.initGraph();
					self.initRects();
					
				},
				
				/* INIT */
				// create empty grid without label
				initGridY: function() {
					var self = this;
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.x.openTime) { h = h - internalSettings.labels.x.openTime; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }
					
					var elementsCount = 6;
					
					var spacing = Math.floor(h / elementsCount);
					structure.svg.grid.y.group = structure.svg.grid.group.append('g').classed('PAGgridY', true);		
					
					
					for (i = 0; i < elementsCount; i++) {
						
						var line =  structure.svg.grid.y.group.append('line')
																									.attr('x1', j).attr('y1', h - (i*spacing))
																									.attr('x2', graph.width()).attr('y2', h - (i*spacing))
																									.attr('stroke', settings.config.grid.y.color)
						structure.svg.grid.y.elements.push(line);
														
					}
					
				},
			
				// create flat graph
				initGraph: function() {
					
					var self = this;
										
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
					
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.x.openTime) { h = h - internalSettings.labels.x.openTime; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }
					var spacing = Math.floor(w/24);
					
					var rectW = Math.floor(spacing*0.6);
					var offsetX = Math.floor(spacing*0.2);

					for (i = 0; i < 24; i++) {
						
						var x = (i * spacing) + j + (spacing / 2) - (rectW / 2) + (index * offsetX);

						var rect = structure.svg.graph.elements[index].group.append('rect')
																																.attr('x', x)
																																.attr('y', h-1)
																																.attr('width', rectW)
																																.attr('height', 1)
																																.attr('rx', 5)
																																.attr('ry', 5)
																																.attr('fill', settings.config.graph[index].color)
						structure.svg.graph.elements[index].elements.area.push(rect);
						
					}					

					// add label to legend
					var p = structure.legend.append('p')
																	.attr('data-index', index)
					p.append('span')
					 .style('background', settings.config.graph[index].color);
					p.append('label')
					 .text(settings.config.graph[index].legend);
										
					return index;

				},
				
				initLabelX: function() {
					
					var self = this;
										
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.x.openTime) { h = h - internalSettings.labels.x.openTime; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }
					var spacing = Math.floor(w/24);
					
					for (i = 0; i < 24; i++) {
						
						var x = (i * spacing) + j + (spacing / 2);
						
						var label =  structure.svg.label.x.group.append('text')
																										.attr('x', x)
																										.attr('y', h+internalSettings.labels.x.marginTop)
																										.attr('text-anchor','middle')
																										.attr('fill', settings.config.grid.x.label)
																										.text(('0'+i).slice(-2))
						structure.svg.label.x.elements.push(label);
						
					}					
					
				},
				
				/* ANIMATE */
				// animate main graph
				mainGraph: function(data) {
					
					var self = this;
					var index = 0;

					if (data == undefined) { var data = structure.data[0]; }
					if (data.length == 0) return;
					
					structure.data[0] = data;
					if (structure.svg.label.x.elements.length == 0) { self.initLabelX();	}
					var allData = mergeAndClean(structure.data);
					structure.svg.grid.y.spacing = Yspacing(allData);
					self.animateLabelY(allData);
					
					setTimeout(function() {
											
						self.animateGraph(structure.data[0], 0);
						if (structure.data[1] != null) { 	self.animateGraph(structure.data[1], 1); }
						
					}, internalSettings.animateGridTime);										
					
				},

				// animate compare graph
				compareWith: function(data) {
					
					var self = this;
					var index = (structure.svg.graph.elements.length == 1) ? self.initGraph() : 1;

					if (data == undefined) { var data = structure.data[1]; }
					if (data.length == 0) return;
					
					structure.data[1] = data;
					var allData = mergeAndClean(structure.data);
					structure.svg.grid.y.spacing = Yspacing(allData);
					self.animateLabelY(allData);

					self.animateGraph(structure.data[0], 0);
					self.animateGraph(structure.data[1], 1);
										
				},								
				// fix the number of labels and animate
				// remove the labels outside the artboard
				animateLabelY: function(data) {
					var self = this;
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					var elementsCount = data.length;

					if (settings.config.grid.x.label) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.x.openTime) { h = h - internalSettings.labels.x.openTime; }
					if (settings.config.grid.y.label) {  j = internalSettings.labels.y.width; w = w - j; }
					
					var elementsCount = 6;
					var spacing = Math.floor(h / elementsCount);
					
					// hide current labels
					structure.svg.label.y.group.classed('PAhide', true);
					
					// fix the number of labels and position
					setTimeout(function() {
						for (i = 0; i < elementsCount; i++) {
							
							if (structure.svg.label.y.elements[i]) { // move existing and update text

								structure.svg.label.y.elements[i].text(structure.svg.grid.y.spacing[i])

							} else {
								var label =  structure.svg.label.y.group.append('text')
																	.attr('x', 50)
																	.attr('y', h - (i*spacing))
																	.attr('text-anchor','end')
																	.attr('fill', settings.config.grid.y.label)
																	.text(structure.svg.grid.y.spacing[i])
								structure.svg.label.y.elements.push(label);
							}
															
						}
						
					}, internalSettings.animateGridTime);
										
					setTimeout(function() {
						// show current labels
						structure.svg.label.y.group.classed('PAhide', false);
					}, internalSettings.animateGridTime*2)
								
				},
								
				// animate line and area
				animateGraph: function(data, index) {
					var self = this;
					
					var index = index || 0;
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.x.openTime) { h = h - internalSettings.labels.x.openTime; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }

					var spacingX = Math.floor(w / (data.length - 1) );
					var spacingY = (Math.floor(h / 6)) / (structure.svg.grid.y.spacing[1] - structure.svg.grid.y.spacing[0]);
					
					for (i in structure.svg.graph.elements[index].elements.area) {
						
						var y = parseInt(h - ((data[i].value - structure.svg.grid.y.spacing[0])  * spacingY ));						
						
						structure.svg.graph.elements[index].elements.area[i].transition()
																			    												.duration(internalSettings.graphAnimationTime)
																			    												.attr('y', y)
																			    												.attr('height', h-y)
																			    												.attr('data-value', data[i].value)
																			    												.ease(internalSettings.animateEasing)					
					}
										
				},								
				
				// remove last graph
				removeCompare: function() {
					
					var self = this;
					var index = 1;
				
					if (structure.data[1] == null) return;
					
					var h = graph.height();
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.x.openTime) { h = h - internalSettings.labels.x.openTime; }

					structure.data[index] = null;
					self.mainGraph();
					structure.svg.graph.elements[0].group.classed('percentage', false);
					
					// flatten compare
					for (i in structure.svg.graph.elements[index].elements.area) {
						
						structure.svg.graph.elements[index].elements.area[i].transition()
																			    												.duration(internalSettings.graphAnimationTime)
																			    												.attr('y', h-1)
																			    												.attr('height', 1)
																			    												.ease(internalSettings.animateEasing)
						
					}
					
					setTimeout(function() {
					
						structure.svg.graph.elements[index].group.remove();
						structure.svg.graph.elements.pop();
						graph.find('div.PAlegend > p[data-index='+index+']').remove()
					
					}, internalSettings.graphAnimationTime);

					
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
							
							structure.tooltip
								.style('color', settings.config.graph[index].color)
								.select('span').text($(this).attr('data-value'));

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
								
				// move the selected graph on front
				moveOnFront: function(index) {
					
					var self = this;
					var g = graph.find('g.PAGgraphs');
					g.find('g.PAGgraph[data-index='+index+']').appendTo(g);
					
				},
				
				openingTime: function(open, close) {
					
					var self = this;
					if (self.openTimeElements.open.line != null) {
						self.removeOpeningTime(function() {
							self.setOpeningTime(open, close);
						})
					} else {
						self.setOpeningTime(open, close);
					}
					
				},
				
				setOpeningTime: function(open, close) {
					
					var self = this;
					
					var close = (close == 24) ? 0 : close;
					
					if (self.openTimeElements.open.line != null) return;
															
					var w = graph.width();
					var h = graph.height();
					var j = 0;
										
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.x.openTime) { h = h - internalSettings.labels.x.openTime; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }
					var spacing = Math.floor(w/24);
					var offset = Math.floor(spacing*0.64);
					
					var ox = parseInt(spacing * (open+1) + offset);
					var cx = parseInt(spacing * (close+2) + offset);

					var line =  structure.svg.grid.y.group.append('line')
																								.attr('x1', ox).attr('y1', graph.height())
																								.attr('x2', ox).attr('y2', graph.height())
																								.attr('stroke', '#000');
					self.openTimeElements.open.line = line;
					line.transition()
							.duration(internalSettings.animateGridTime)
							.attr('y1', 0)
							.ease(internalSettings.animateEasing);
																								
					var line =  structure.svg.grid.y.group.append('line')
																								.attr('x1', cx).attr('y1', graph.height())
																								.attr('x2', cx).attr('y2', graph.height())
																								.attr('stroke', '#000');
					self.openTimeElements.close.line = line;
					line.transition()
							.duration(internalSettings.animateGridTime)
							.attr('y1', 0)
							.ease(internalSettings.animateEasing);
					
					// icons
					// open
					var openG = structure.svg.grid.y.group.append('g')
																								.attr('transform', 'translate('+ (ox+5)+','+ (graph.height()-18) +')')
					var openIco = openG.append('path')
														 .attr('d', self.iconsPath.open)
														 .attr('fill', '#FFB600')
														 .style('opacity', 0);
					self.openTimeElements.open.icon = openG;
					self.openTimeElements.open.icon.select('path').transition()
																				 .duration(internalSettings.animateGridTime)
																				 .style('opacity', 1)
																				 .ease(internalSettings.animateEasing);
														 

					// close
					var closeG = structure.svg.grid.y.group.append('g')
																								 .attr('transform', 'translate('+ (cx+5)+','+ (graph.height()-19) +')')
					var closeIco = closeG.append('path')
														 .attr('d', self.iconsPath.close)
														 .attr('fill', '#203B8D')
														 .style('opacity', 0);
					self.openTimeElements.close.icon = closeG;
					self.openTimeElements.close.icon.select('path').transition()
																					.duration(internalSettings.animateGridTime)
																					.style('opacity', 1)
																					.ease(internalSettings.animateEasing);
										
				},
				
				removeOpeningTime: function(callback) {
					
					var self = this;
					if (self.openTimeElements.open.line == null) return;
					
					self.openTimeElements.open.line.transition()
																				 .duration(internalSettings.animateGridTime)
																				 .attr('y1', graph.height())
																				 .ease(internalSettings.animateEasing)
																					.each('end', function() {
																						self.openTimeElements.open.line.remove();
																						self.openTimeElements.open.line = null;
																					})

					self.openTimeElements.close.line.transition()
																					.duration(internalSettings.animateGridTime)
																					.attr('y1', graph.height())
																					.ease(internalSettings.animateEasing)
																					.each('end', function() {
																						self.openTimeElements.close.line.remove();
																						self.openTimeElements.close.line = null;
																					})

					self.openTimeElements.open.icon.transition()
																				 .duration(internalSettings.animateGridTime)
																				 .style('opacity', 0)
																				 .ease(internalSettings.animateEasing)
																					.each('end', function() {
																						self.openTimeElements.open.icon.remove();
																						self.openTimeElements.open.icon = null;
																					})
																				 
					self.openTimeElements.close.icon.transition()
																					.duration(internalSettings.animateGridTime)
																					.style('opacity', 0)
																					.ease(internalSettings.animateEasing)
																					.each('end', function() {
																						self.openTimeElements.close.icon.remove();
																						self.openTimeElements.close.icon = null;
																					})
																					
					if (typeof callback == 'function') {
						setTimeout(function() {
							callback.call();
						}, internalSettings.animateGridTime+10);
					}
																					
					
				}
							
			},
						
		}
		
		MODE[settings.mode].init();
				
		graph.mainGraph = function(data) {
			
			if (typeof settings.preFetch == 'function') { var data = settings.preFetch(data); }
			MODE[settings.mode].mainGraph(data);
			
		};
		
		graph.compareWith = function(data) {
			
			if (typeof settings.preFetch == 'function') { var data = settings.preFetch(data); }
			MODE[settings.mode].compareWith(data);
			
		};
		
		graph.removeCompare = function() {
			
			MODE[settings.mode].removeCompare();
			
		}

		graph.applyFilter = function(data, filter) {
			
			if (settings.mode != 'history') return;
			if (typeof settings.preFetch == 'function') { var data = settings.preFetch(data); }
			MODE[settings.mode].applyFilterToData(data, filter);
			
		};
		
		graph.setOpeningTime = function(open, close) {
			
			if (settings.mode != 'daytime') return;
			MODE['daytime'].openingTime(open,close);
			
		}
		
		graph.removeOpeningTime = function() {
			
			if (settings.mode != 'daytime') return;
			MODE['daytime'].removeOpeningTime();
			
		}
		
		function getRandomColor() {
			return '#'+(Math.random()*0xFFFFFF<<0).toString(16);
		}
						
		function Yspacing(data, lines) {
			
			var lines = lines || 5;
			
			var max = getMaxValues(data);
			var min = getMinValues(data);

			var perc = Math.ceil((max - min) * 0.05);
			max += perc;
			min -= perc;

			
			var space = Math.round((max - min) / lines);
			var divisor = (space.toString().length - 1) * 10;
			var spacer = Math.round(space / divisor) * divisor
			
			var bottom = Math.floor(min / spacer) * spacer;
			var top = Math.ceil(max / spacer) * spacer;
			
			var labels = [];
			
			for (i = bottom; i <= top; i=i+spacer) { labels.push(i); }
			
			return labels;
						
		}
		
		function mergeAndClean(arr) {
						
			var result = [];
			for (i in arr) {
				for (x in arr[i]) {
					result.push(arr[i][x]);
				}
			}
			
			
			return result;
			
		}
		
		function getMaxValues(data, k) {
			if (k == undefined) { k = 'value'; }
			return Math.max.apply( null, Object.keys( data ).map(function (key) { return data[key][k];	}));		
		}
	
		function getMinValues(data, k) {
			if (k == undefined) { k = 'value'; }
			return Math.min.apply( null, Object.keys( data ).map(function (key) { return data[key][k];	}));		
		}
		
		function debug() {
			if (settings.debug) { console.debug(arguments);	}
		}
					
		return graph;

	};
	
	
	// counter
  $.fn.PAcounter = function( options ) {
		
		// default options
    var settings = $.extend(true, {
			icon: '',
			value: 0,
			diff: 0
		}, options );
		
		var graph = this;
		
		graph.addClass('PAcounterContainer PAinactive');
		
		var iconCounter = $('<span></span>').addClass('PAicon');
		
		var mainCounter = $('<span></span>').attr('data-value', settings.value)
																				.text(settings.value)
																				.addClass('PAmain PAcount');
																				
		var compareCounter = $('<span></span>').attr('data-value', settings.diff)
																					 .text(settings.diff)
																					 .addClass('PAcompare PAcount')
																					 .toggleClass('PAnegative', settings.diff < 0)
																					 .toggleClass('PAnull', settings.diff == 0)
		
		graph.append(iconCounter)
		graph.append(mainCounter)
		graph.append(compareCounter)
		
		$.get(settings.icon, function(svg) {
			iconCounter.append($(svg));
			animateNumber(graph.find('span.PAcount'), 1000);
			graph.removeClass('PAinactive');
		}, 'text');
		
		function animateNumber(selector, time) {
			
			selector.each(function () {
			  var el = $(this).text('0');
	
			  // backup
				var timer = setTimeout(function(){ el.text(el.attr('data-value')); }, time+10);
	
			  $({ c:0 }).animate({ c: el.attr('data-value') }, {
			    duration: time,
			    step: function () {
				    var v = Math.ceil(this.c);
				    if (v == el.attr('data-value')) { clearInterval(timer); }
			      el.text(v);
			    }
			  });
			  
			});
			
		}
		
		return graph;
		
	};
	
	
	

}( jQuery ));

String.prototype.capitalizeFirstLetter = function() { return this.charAt(0).toUpperCase() + this.slice(1); }