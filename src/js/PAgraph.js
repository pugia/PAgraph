// PAgraph Plugin
(function ($) {

  $.fn.PAgraph = function( options ) {
		
		// default options
    var settings = $.extend(true, {
			
			mode: 'history',
	
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
						label: '#C1C1C1'
					},
					y: {
						show: true,
						color: '#C6CED3',
						label: '#C1C1C1'
					}
				}
			}
						
		}, options );
		
		var graph = this;
		graph.addClass('PAgraphContainer');
		
		var structure = {
			legend: null,
			tooltip: null,
			data: [null,null],
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
			graphLineInterpolation: 'cardinal'

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
																										 .attr('width', graph.width())
																										 .attr('height', graph.height());
		structure.svg.grid.group = structure.svg.element.append('g').classed('PAGgrid', true);
		structure.svg.label.x.group = structure.svg.element.append('g').classed('PAGlabelX', true);
		structure.svg.label.y.group = structure.svg.element.append('g').classed('PAGlabelY', true);
		structure.svg.graph.group = structure.svg.element.append('g').classed('PAGgraphs', true);	
																										

		var MODE = {
			
			history: {
			
				mode: 'daily', // daily, weekly, monthly 
								
				// start with a week structure
				init: function() {
					
					debug('MODE: history');
					
					var self = this;
					
					self.grid();
					
				},
				
				grid: function() {
					
					var self = this;
					
					self.initGridX();
					self.initGridY();
					self.initGraph();
					self.initLegend();
					self.initCircles();
					
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
				
				mainGraph: function(data) {
					
					var self = this;
					var index = 0;
					
					if (data == undefined) { var data = structure.data[0]; }
					if (data.length == 0) return;
					
					structure.data[0] = data;
					var allData = mergeAndClean(structure.data);
					structure.svg.grid.y.spacing = Yspacing(allData);

					if (data.length != structure.svg.grid.x.elements.length) {
						if (structure.data[1]) { self.removeCompareGraph() }
						structure.svg.grid.y.spacing = Yspacing(data);
						self.flattenGraph(data, 0, function() {
							self.drawGraphAnimation(structure.data[0], 0);
						})	
					} else {
						self.drawGraphAnimation(structure.data[0], 0);
						if (structure.data[1]) { self.drawGraphAnimation(structure.data[1], 1); }
					}
					
				},
				
				compareWith: function(data) {
					
					var self = this;
					var index = structure.svg.graph.elements.length == 1 ? self.initGraph() : 1;
					
					if (data == undefined) { var data = structure.data[index]; }
					if (data.length == 0) return;

					structure.data[index] = data;
					var allData = mergeAndClean(structure.data);
					structure.svg.grid.y.spacing = Yspacing(allData);
					
					if (data.length != structure.svg.grid.x.elements.length) {
						self.flattenGraph(data, index, function() {
							self.drawGraphAnimation(structure.data[0], 0);
							self.drawGraphAnimation(structure.data[1], 1);
						})	
					} else {
						self.drawGraphAnimation(structure.data[0], 0);
						self.drawGraphAnimation(structure.data[1], 1);
					}
					
				},
				
				/* ANIMATE */
				// draw graph data
				drawGraph: function(data, index) {
					
					var self = this;
					
					if (data.length == 0) return;
					
					structure.svg.grid.y.spacing = Yspacing(data);
					if (data.length != structure.svg.grid.x.elements.length) {
						self.flattenGraph(data, index, function() {
							self.drawGraphAnimation(data, index);
						})	
					} else {
						self.drawGraphAnimation(data, index);
					}
					
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
					structure.svg.label.x.group.classed('hide', true)
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
							structure.svg.label.x.elements[i].remove();
								
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
			
					var nthChildX = 1;
					var l1_index = 1;
					var l1_size = structure.svg.label.x.elements[l1_index][0][0].getBBox();

					var l2_index = 2;					
					var l2_size = structure.svg.label.x.elements[l2_index][0][0].getBBox();
					
					while (l1_size.x + l1_size.width + 10 > l2_size.x) {
						nthChildX++; l2_index++;
						l2_size = structure.svg.label.x.elements[l2_index][0][0].getBBox();
					}			
		
					structure.svg.label.x.group.selectAll('text:nth-child('+nthChildX+'n+2)')
																		 .classed('show', true);
					
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
					structure.svg.label.y.group.classed('hide', true);
					
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
						structure.svg.label.y.group.classed('hide', false);
					}, internalSettings.animateGridTime*2)
								
				},
				
				// animate line and area
				animateGraph: function(data, index) {
					var self = this;
					
					var w = graph.width();
					var h = graph.height();
					var j = 0;
					
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }

					var spacingX = Math.floor(w / (data.length - 1) );
					var spacingY = (Math.floor(h / 6)) / (structure.svg.grid.y.spacing[1] - structure.svg.grid.y.spacing[0]);
					
					// remove circles
					structure.svg.graph.elements[index].group.selectAll('circle').classed('hide', 'true');
					setTimeout(function() {
						structure.svg.graph.elements[index].group.selectAll('circle.hide').remove();
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
					
					if (settings.config.grid.x.label != false) { h = h - internalSettings.labels.x.height; }
					if (settings.config.grid.y.label != false) {  j = internalSettings.labels.y.width; w = w - j; }

					var spacingBefore = Math.floor(w / (structure.svg.grid.x.elements.length - 1) );
					var spacingNext = Math.floor(w / (data.length - 1) );

					// remove circles
					structure.svg.graph.elements[index].group.selectAll('circle').classed('hide', true);
					setTimeout(function() {
						structure.svg.graph.elements[index].group.selectAll('circle.hide').remove();
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
				
				// add a graph in back
				addGraph: function(data) {
					
					var self = this;
										
					var index = self.initGraph();
					self.animateGraph(data, index);
					
				},
				
				// remove last graph
				removeCompareGraph: function() {
					
					var self = this;
					self.flattenGraph([], 1, function() {
						structure.svg.graph.elements[1].group.remove();
						structure.svg.graph.elements.pop();
						graph.find('div.PAlegend > p[data-index=1]').remove()
						structure.data[1] = null;
					});
					
				},
				
				removeCompare: function() {
					
					var self = this;
					self.removeCompareGraph();
					setTimeout(function() {
						self.mainGraph();
					}, internalSettings.graphAnimationTime+2);
					
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
				
				initCircles: function() {
					var self = this;
					
					graph
						.on('mouseover', 'circle', function() {
							
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
							
							var px = $(this).attr('cx'),
									py = $(this).attr('cy')
									
							var top = py - h - 20,
									left= px - parseInt(w/2)
							
							t.css('top', top)
							 .css('left',left)
							 .addClass('show')
							
						})
						.on('mouseout', 'circle', function() {
							structure.tooltip.classed('show', false);
							setTimeout(function() {
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
					self.initCircles();
					
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
				
				/* ANIMATE */
				// draw graph data
				drawGraph: function(data, index) {
					
					var self = this;
					if (data.length == 0) return;
					
					structure.data[index] = data;

					var allData = (structure.svg.graph.elements.length > 1) ? structure.data[0].concat(structure.data[1]) : data;					
					structure.svg.grid.y.spacing = Yspacing(allData, 5);
					self.animateLabelY(allData);
					
					setTimeout(function() {
											
						self.animateGraph(structure.data[0], 0);
						if (structure.svg.graph.elements.length > 1) {
							self.animateGraph(structure.data[1], 1);
						}
						
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
					structure.svg.label.y.group.classed('hide', true);
					
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
						structure.svg.label.y.group.classed('hide', false);
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
																			    												.ease(internalSettings.animateEasing)					
					}
										
				},
				
				// comparison
				compareWith: function(data) {
														
					var self = this;
					var index = (structure.svg.graph.elements.length == 1) ? self.initGraph() : 1;
					
					structure.data[index] = data;
					
					var allData = structure.data[0].concat(structure.data[1]);
					structure.svg.grid.y.spacing = Yspacing(allData, 5);
					
					self.animateLabelY(allData);
					
					self.animateGraph(structure.data[0], 0);
					self.animateGraph(structure.data[1], 1);
					
				},
				
								
				// add a graph in back
				addGraph: function(data) {
					
					var self = this;
										
					var index = self.initGraph();
					self.animateGraph(data, index);
					
				},
				
				// remove last graph
				removeGraph: function() {
					
					var self = this;
					var index = structure.svg.graph.elements.length - 1;
					self.flattenGraph([], index, function() {
						structure.svg.graph.elements[index].group.remove();
						structure.svg.graph.elements.pop();
						graph.find('div.PAlegend > p[data-index='+index+']').remove()
						
					});
					
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
				
				initCircles: function() {
					var self = this;
					
					graph
						.on('mouseover', 'circle', function() {
							
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
							
							var px = $(this).attr('cx'),
									py = $(this).attr('cy')
									
							var top = py - h - 20,
									left= px - parseInt(w/2)
							
							t.css('top', top)
							 .css('left',left)
							 .addClass('show')
							
						})
						.on('mouseout', 'circle', function() {
							structure.tooltip.classed('show', false);
							setTimeout(function() {
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
							
			},
						
		}
		
		MODE[settings.mode].init();
		
		self.drawGraph = function(data, index) {
			
			MODE[settings.mode].drawGraph(data, index);
			
		};
		
		self.mainGraph = function(data) {
			
			MODE[settings.mode].mainGraph(data);
			
		};
		
		self.compareWith = function(data) {
			
			MODE[settings.mode].compareWith(data);
			
		};
		
		self.addGraph = function(data) {

			MODE[settings.mode].addGraph(data);

		}
		
		self.removeCompare = function() {
			
			MODE[settings.mode].removeCompare();
			
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
					
		return self;

	};



}( jQuery ));