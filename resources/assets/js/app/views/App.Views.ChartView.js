;( function() {
	
	"use strict";

	var App = require( "./../namespaces.js" ),
		Header = require( "./chart/App.Views.Chart.Header.js" ),
		Footer = require( "./chart/App.Views.Chart.Footer.js" ),
		ScaleSelectors = require( "./chart/App.Views.Chart.ScaleSelectors" ),
		ChartTab = require( "./chart/App.Views.Chart.ChartTab.js" ),
		DataTab = require( "./chart/App.Views.Chart.DataTab.js" ),
		SourcesTab = require( "./chart/App.Views.Chart.SourcesTab.js" ),
		MapTab = require( "./chart/App.Views.Chart.MapTab.js" ),
		ChartDataModel = require( "./../models/App.Models.ChartDataModel.js" ),
		Utils = require( "./../App.Utils.js" ),
		ExportPopup = require( "./ui/App.Views.UI.ExportPopup.js" );

	App.Views.ChartView = Backbone.View.extend({

		activeTab: false,
		el: "#chart-view",
		events: {
			"click .chart-export-btn": "exportContent"
		},

		initialize: function( options ) {
			var that = this;
			//enable overriding default tab setting with tab query parameter
			this.setDefaultTabFromUrl();

			this.dispatcher = options.dispatcher;
			
			var childViewOptions = { dispatcher: this.dispatcher, parentView: this };
			this.header = new Header(childViewOptions);
			this.footer = new Footer(childViewOptions);
			this.scaleSelectors = new ScaleSelectors(childViewOptions);
			//tabs
			this.chartTab = new ChartTab(childViewOptions);
			this.dataTab = new DataTab(childViewOptions);
			this.sourcesTab = new SourcesTab(childViewOptions);
			this.mapTab = new MapTab(childViewOptions);
			this.mapTab.on("tab-ready", function() { that.header.render(); });
			this.tabs = [this.chartTab, this.dataTab, this.sourcesTab, this.mapTab];
			//setup model that will fetch all the data for us
			this.dataModel = new ChartDataModel();
			
			this.exportPopup = new ExportPopup( options );
			this.exportPopup.init( options );

			//setup events
			this.dataModel.on( "sync", this.onDataModelSync, this );
			this.dataModel.on( "error", this.onDataModelError, this );
			App.ChartModel.on( "change", this.onChartModelChange, this );

			this.dispatcher.on( "dimension-export-update", this.onDimensionExportUpdate, this );
			this.dispatcher.on( "dimension-export", this.onDimensionExport, this );
			this.dispatcher.on( "dimension-export-cancel", this.onDimensionExportCancel, this );

			$("[data-toggle='tab']").on("shown.bs.tab", function(evt) {
				_.each(that.tabs, function(tab) { 
					if ($(evt.target).attr('href') === "#"+tab.$tab.attr('id')) {
						that.activeTab = tab;
						that.activeTab.once("tab-ready", function() { that.onResize(); });						
						tab.activate();
						if (tab == that.mapTab)
							that.header.render();
					}
				});
			});


			nv.utils.windowResize(_.debounce(function() {
				that.onResize();
			}, 150));
					

			var defaultTab = App.ChartModel.get("default-tab");
			$("." + defaultTab + "-header-tab a").tab('show');
		},

		render: function() {
			return;
			var that = this;

			this.$preloader = this.$el.find( ".chart-preloader" );
			this.$error = this.$el.find( ".chart-error" );

			//chart tab
			this.$svg = this.$el.find( "#chart-chart-tab svg" );
			this.$tabContent = this.$el.find( ".tab-content" );
			this.$tabPanes = this.$el.find( ".tab-pane" );
			this.$chartHeader = this.$el.find( ".chart-header" );
			this.$entitiesSelect = this.$el.find( "[name=available_entities]" );
			this.$chartFooter = this.$el.find( ".chart-footer" );

			this.$chartDescription = this.$el.find( ".chart-description" );
			this.$chartSources = this.$el.find( ".chart-sources" );
			this.$chartFullScreen = this.$el.find( ".fancybox-iframe" );

			this.$xAxisScaleSelector = this.$el.find( ".x-axis-scale-selector" );
			this.$xAxisScale = this.$el.find( "[name=x_axis_scale]" );
			this.$yAxisScaleSelector = this.$el.find( ".y-axis-scale-selector" );
			this.$yAxisScale = this.$el.find( "[name=y_axis_scale]" );

			this.$reloadBtn = this.$el.find( ".reload-btn" );

			var formConfig = App.ChartModel.get( "form-config" ),
				entities = ( formConfig && formConfig[ "entities-collection" ] )? formConfig[ "entities-collection" ]: [],
				selectedCountries = App.ChartModel.get( "selected-countries" ),
				selectedCountriesIds = _.map( selectedCountries, function( v ) { return (v)? +v.id: ""; } ),
				chartTime = App.ChartModel.get( "chart-time" );

			var chartDescription = App.ChartModel.get( "chart-description" );
			//this.$chartDescription.text( App.ChartModel.get( "chart-description" ) );

			//show/hide scale selectors
			var showXScaleSelectors = App.ChartModel.get( "x-axis-scale-selector" );
			if( showXScaleSelectors ) {
				this.$xAxisScaleSelector.show();
			} else {
				this.$xAxisScaleSelector.hide();
			}
			var showYScaleSelectors = App.ChartModel.get( "y-axis-scale-selector" );
			if( showYScaleSelectors ) {
				this.$yAxisScaleSelector.show();
			} else {
				this.$yAxisScaleSelector.hide();
			}

			//update countries
			this.$entitiesSelect.empty();
			if( selectedCountriesIds.length ) {
				//append empty default option
				that.$entitiesSelect.append( "<option disabled selected>Select country</option>" );
				_.each( entities, function( d, i ) {
					//add only those entities, which are not selected already
					if( _.indexOf( selectedCountriesIds, +d.id ) == -1 ) {
						that.$entitiesSelect.append( "<option value='" + d.id + "'>" + d.name + "</option>" );
					}
				} );
			}
			//make chosen update, make sure it looses blur as well
			this.$entitiesSelect.trigger( "chosen:updated" );

			this.$chartFullScreen.on( "click", function( evt ) {
				evt.preventDefault();
				var $this = $( this );
				window.parent.openFancyBox( $this.attr( "href" ) );
			} );

			//refresh btn
			this.$reloadBtn.on( "click", function( evt ) {
				evt.preventDefault();
				window.location.reload();
			} );

			//chart tab
			this.$chartTab = this.$el.find( "#chart-chart-tab" );

			var dimensionsString = App.ChartModel.get( "chart-dimensions" ),
				validDimensions = false;

			//clicking anything in chart source will take you to sources tab
			this.$chartSources.on( "click", function(evt) {
				evt.preventDefault();
				var $a = $( "[href='#sources-chart-tab']" );
				$a.trigger( "click" );
			} );

			//check we have all dimensions necessary 
			if( !$.isEmptyObject( dimensionsString ) ) {
				var dimension = $.parseJSON( dimensionsString );
				validDimensions = Utils.checkValidDimensions( dimension, App.ChartModel.get( "chart-type" ));
			}

			if( !validDimensions ) {
				return false;
			}

			if( dimensionsString ) {
				this.$preloader.show();

				var dataProps = { "dimensions": dimensionsString, "chartId": App.ChartModel.get( "id" ), "chartType": App.ChartModel.get( "chart-type" ), "selectedCountries": selectedCountriesIds, "chartTime": chartTime, "cache": App.ChartModel.get( "cache" ), "groupByVariables": App.ChartModel.get( "group-by-variables" )  };

				this.dataModel.fetch( { data: dataProps } );
			} else {
				//clear any previous chart
				$( "svg" ).empty();
			}
		},

		setDefaultTabFromUrl: function() {
			var tab = Utils.getQueryVariable( "tab" );
			if( tab ) {
				//there is something in the url, check that it's not non-sensical value
				var tabs = [ "chart", "data", "map", "sources" ];
				if( _.contains( tabs, tab ) ) {
					App.ChartModel.set( "default-tab", tab, { silent: true } );
				}
			}
		},

		/*displayTab: function( id ) {

			console.log( "ChartView id", id );

		},*/

		onChartModelChange: function( evt ) {

			this.render();
			
		},

		onDataModelSync: function( model, response ) {
			this.$error.hide();
			this.$preloader.hide();
			if( response.data ) {
				this.updateChart( response.data, response.timeType, response.dimensions );
			}
			this.sourcesTab.render( response );
		},

		onDataModelError: function() {
			this.$error.show();
			this.$preloader.hide();
		},

		exportContent: function( evt ) {
			
			evt.preventDefault();
			this.exportPopup.show();
			return false;

		},

		onDimensionExportUpdate: function( data ) {

			if( !this.oldWidth ) {
				this.oldWidth = this.$el.width();
				this.oldHeight = this.$el.height();
			}

			//need to account for padding
			var $chartWrapperInner = $( ".chart-wrapper-inner" ),
				paddingLeft = parseInt( $chartWrapperInner.css( "padding-left" ), 10 ),
				paddingRight = parseInt( $chartWrapperInner.css( "padding-right" ), 10 ),
				paddingTop = parseInt( $chartWrapperInner.css( "padding-top" ), 10 ),
				paddingBottom = parseInt( $chartWrapperInner.css( "padding-bottom" ), 10 );

			data.width = parseInt( data.width, 10) + (paddingLeft + paddingRight);
			data.height = parseInt( data.height, 10) + (paddingTop + paddingBottom);

			//account for different heights of html and svg header
			//data.height += 36;//56;
			//account for different heights of html and svg footer
			//data.height += 29;//49;

			this.$el.width( data.width );
			this.$el.height( data.height );
			
			this.onResize();

		},

		onDimensionExportCancel: function() {
			this.resetExportResize();
		},

		onDimensionExport: function( data ) {

			//export chart into svg or png
			var that = this,
				format = data.format,
				width = parseInt( data.width, 10 ),
				height = parseInt( data.height, 10 ),
				isSvg = ( format === "svg" )? true: false,
				exportMap = ( this.$el.find( "#map-chart-tab" ).is( ":visible" ) )? true: false,
				$chartLogoSvg = $( ".chart-logo-svg" );
			
			//http://stackoverflow.com/questions/23218174/how-do-i-save-export-an-svg-file-after-creating-an-svg-with-d3-js-ie-safari-an
			var $oldEl = this.$el,
				$newEl = $oldEl.clone();

			if( !exportMap ) {
				$oldEl.replaceWith( $newEl );
			}
			
			//grab all svg
			var $exportSvg;
			if( exportMap ) {
				$exportSvg = $( ".datamap" );
			} else {
				$exportSvg = $( "svg.nvd3-svg" );
			}
			//add printing styles
			if( exportMap ) {
				$exportSvg.attr( "class", "datamap nvd3-svg export-svg" );
				
				//for exporting map, we need to add logo
				$exportSvg.append( $chartLogoSvg );
				
			} else {
				//add classes 
				$exportSvg.attr( "class", "nvd3-svg export-svg" );
			}

			$chartLogoSvg = $( ".chart-logo-svg" );

			//position svg logo
			var $chartWrapperInner = $( ".chart-wrapper-inner" ),
				innerPaddingLeft = parseInt( $chartWrapperInner.css("padding-left"), 10),
				innerPaddingRight = parseInt( $chartWrapperInner.css("padding-right"), 10),
				margins = App.ChartModel.get( "margins" ),
				elWidth = this.$el.width() - innerPaddingLeft - innerPaddingRight,//svgWidth
				boundingRect = $chartLogoSvg.get(0).getBoundingClientRect(),
				logoSvg = boundingRect.right - boundingRect.left,
				scale = ( $chartLogoSvg.hasClass( "default-logo" ) )? 0.4: 1,
				translateX = elWidth - margins.right - logoSvg,//elWidth;
				translateY = 20;
			
			$chartLogoSvg.attr( "transform", "scale(" + scale + "," + scale + "), translate(" + translateX + "," + translateY + ")" );

			//we need to add all elements that are in html so they wouldn't be printed
			this.addTextsForExport( $exportSvg, width, height, exportMap );
			
			//inline styles for the export
			var styleSheets = document.styleSheets;
			for( var i = 0; i < styleSheets.length; i++ ) {
				Utils.inlineCssStyle( styleSheets[ i ].cssRules );
			}

			$exportSvg.width( width );
			$exportSvg.height( height );
			
			//depending whether we're creating svg or png, 
			if( isSvg ) {
				
				var cb = function( url ) {
					
					//activate click on dummy button
					var $chartSaveBtn = $( ".chart-save-btn" );
					$chartSaveBtn.attr( "href", url );
					//$chartSaveBtn.attr( "download", "ourworldindata-grapher" );
					$chartSaveBtn.get(0).click();

					//safari will ingore click event on anchor, need to have work around that opens the svg at least in the same browser
					var isSafari = navigator.userAgent.indexOf("Safari") > -1 && navigator.userAgent.indexOf("Chrome") === -1;
					//temp try to always open new window
					isSafari = true;
					if( !isSafari ) {
						setTimeout( function() {
							window.location.reload();
						}, 250 );
					} else {
						//safari workaround
						window.location = url;
					}
					
				};

				//add white background - MAX wanted to remove
				/*var $rect = $( "<rect width='" + width + "' height='" + height + "' style='fill:#ffffff;'></rect>" );
				$exportSvg.prepend( $rect );*/
				
				//remove voronoi
				$exportSvg.find(".nv-point-paths").remove();

				//remove add country button, display:none won't work in illustrator
				var $addCountryBtn = $exportSvg.find( ".nv-add-btn,.nv-remove-btn" );
				$addCountryBtn.remove();
				svgAsDataUri( $exportSvg.get( 0 ), {}, cb );
				
			} else {
				
				saveSvgAsPng( $exportSvg.get( 0 ), "chart.png" );
				setTimeout( function() {
					window.location.reload();
				}, 250 );
				
			}
			
		},

		addTextsForExport: function( $svg, width, height, exportMap ) {

			var margins = App.ChartModel.get( "margins" );

			//add elements
			var selectors = [ "chart-name", "chart-subname", "chart-sources", "chart-description" ];
			_.each( selectors, function( selector ) {

				var $el = $( "#chart-view ." + selector ),
					className = selector + "-svg",
					svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');

				//setup attributes
				svgEl.setAttribute('class', className);
				svgEl.setAttribute('dy', 0);
				svgEl.textContent = $el.text();

				$svg.append( svgEl );
				
				//fetch jquery object for use in Utils wrap
				var $svgEl = $( "." + className );
				//convert single line text into multi-line wrapped tspan
				if( selector === "chart-name" || selector === "chart-subname" ) {
					//account for logo on the right
					width -= 50;
				}
				Utils.wrap( $svgEl, width );

			} );

			//if exporting chart tab, create wrapper and put everything but logo into it, so that we can then offset it 
			var $parentEl = $svg,
				holderClass = "nvd3-print-chart-holder",
				$printHolder;

			if( !exportMap ) {
				$parentEl.append( "<g class='" + holderClass + "'></g>" );
				$printHolder = $parentEl.find( "." + holderClass );
				$printHolder.append( $( "svg.nvd3-svg > .nv-wrap" ) );
				$printHolder.append( $( ".nv-custom-legend" ) );
			} else {
				$printHolder = $svg;
			}
			
			//resize them
			var titleEl = $( ".chart-name-svg").get(0), titleRect = titleEl.getBoundingClientRect(), titleHeight = titleRect.bottom - titleRect.top,
				subTitleEl = $( ".chart-subname-svg").get(0), subTitleRect = subTitleEl.getBoundingClientRect(), subTitleHeight = subTitleRect.bottom - subTitleRect.top,
				//printHolder doesn't have height at this point, so using parentEl bounding rect as replacement here
				chartHolderEl = $printHolder.get(0), chartHolderRect = $parentEl.get(0).getBoundingClientRect(), chartHolderHeight = chartHolderRect.bottom - chartHolderRect.top,
				sourcesEl = $( ".chart-sources-svg").get(0), sourcesRect = sourcesEl.getBoundingClientRect(), sourcesHeight = sourcesRect.bottom - sourcesRect.top,
				descriptionEl = $( ".chart-description-svg").get(0), descriptionRect = descriptionEl.getBoundingClientRect(), descriptionHeight = descriptionRect.bottom - descriptionRect.top,
				left = 15,//parseInt( margins.left, 10),
				titleLeft = left + 16,
				//start with margin top and also height of first line of title, cause text contains tspans
				currY = parseInt( margins.top, 10) + 25;

			titleEl.setAttribute("transform", "translate(" + titleLeft + "," + currY + ")" );

			currY += titleHeight;
			subTitleEl.setAttribute("transform", "translate(" + titleLeft + "," + currY + ")" );

			currY += subTitleHeight;
			chartHolderEl.setAttribute("transform", "translate(" + left + "," + currY + ")" );

			currY += chartHolderHeight + parseInt( margins.bottom, 10) + 20;
			sourcesEl.setAttribute("transform", "translate(" + left + "," + currY + ")" );
			
			//possibly also map legend
			var $mapLegend = $( ".map-legend-wrapper" );
			if( $mapLegend.length ) {
				var mapLegendEl = $mapLegend.get(0),
					mapLegendRect = mapLegendEl.getBoundingClientRect(), 
					mapLegendHeight = mapLegendRect.bottom - mapLegendRect.top,
					mapLegendY = currY - mapLegendHeight - 20;
				mapLegendEl.setAttribute("transform", "translate(" + left + "," + mapLegendY + ")" );
			}

			currY += sourcesHeight;
			descriptionEl.setAttribute("transform", "translate(" + left + "," + currY + ")" );
			
		},

		resetExportResize: function() {

			//$newEl.replaceWith( $oldEl );
			this.$el.width( this.oldWidth );
			this.$el.height( this.oldHeight );
			this.onResize();

		},

		updateChart: function( data, timeType, dimensions ) {

			this.chartTab.render( data, timeType, dimensions );
		
		},
	
		onResize: function() {
			console.log(this.activeTab.onResize);
			if (this.activeTab.onResize)
				this.activeTab.onResize();
		},
	});

	module.exports = App.Views.ChartView;

	//backbone router doesn't work properly with browserify, so it's directly inserted here
	/*var Router = Backbone.Router.extend({

		routes: {
				"chart": "onChartRoute",
				"data": "onDataRoute",
				"map": "onMapRoute",
				"sources": "onSourcesRoute",
				"*default": "onDefaultRoute"
		},

		onChartRoute: function() {
			this.displayTab( "chart" );
		},

		onDataRoute: function() {
			this.displayTab( "data" );
		},

		onMapRoute: function() {
			this.displayTab( "map" );
		},

		onSourcesRoute: function() {
			this.displayTab( "sources" );
		},

		onDefaultRoute: function() {
			console.log( "onDefault router" );
		},

		displayTab: function( id ) {
			console.log("displayTab",id);
			//App.View.chartView.displayTab( id );
		}

	});*/

})();