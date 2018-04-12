(function(){

var attrArray = ["Total", "Native Born", "Total Foriegn Born", "EU Foriegn Born", "Non EU Foriegn Born", "Unknown"];
var expressed = attrArray[1];
    
    
//chart frame dimensions
var chartWidth = window.innerWidth * 0.425,
    chartHeight = 480,
    leftPadding = 30,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";   
 
//define the y scale
 var yScale = d3.scaleLinear()
        .range([460, 0])
        .domain([0, 110])
        .nice();    


window.onload = setMap();

//set up choropleth map
function setMap(){
	
	
	
	
	//map frame dimensions
	var width = window.innerWidth * 0.425,
        height = 480;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on France
    var projection = d3.geoAlbers()
        .center([-28.00, 47.24])
        .rotate([-33.55, -4.55, 0])
        .parallels([0.00, 40.25])
        .scale(800)
        .translate([width / 2, height / 2]);
		
	var path = d3.geoPath()
		.projection(projection);
    
   
	
	
    //use queue to parallelize asynchronous data loading
    d3.queue()
        .defer(d3.csv, "data/dataCSV.csv") //load attributes from csv
        .defer(d3.json, "data/Europe.topojson") //load background spatial data
        .defer(d3.json, "data/EuropeRegions.topojson") //load choropleth spatial data
        .await(callback);
		
	function callback(error, csvData, europe, country){
		
		//place graticule on the map
		setGraticule(map, path);
		
		
		
		var europeCountries = topojson.feature(europe, europe.objects.Europe),
            europeRegions = topojson.feature(country, country.objects.EuropeRegions).features;
			
		
		
		
		
		var countries = map.append("path")
            .datum(europeCountries)
            .attr("class", "countries")
            .attr("d", path);

        
			
		europeRegions = joinData(europeRegions, csvData);
		
		var colorScale = makeColorScale(csvData);
		
		setEnumerationUnits(europeRegions, map, path, colorScale);
        
        //add coordinated visualization to the map
        setChart(csvData, colorScale);
		
        createDropdown(csvData);
        
        
        console.log(europe);
        console.log(country);
    };
}; //end of set map

function setGraticule(map, path){
	
		var graticule = d3.geoGraticule()
            .step([10, 10]); //place graticule lines every 5 degrees of longitude and latitude
		
		var gratBackground = map.append("path")
            .datum(graticule.outline()) //bind graticule background
            .attr("class", "gratBackground") //assign class for styling
            .attr("d", path) //project graticule

			
		var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines
    
	};
	
function joinData(europeRegions, csvData){
	
	for (var i=0; i<csvData.length; i++){
        var csvRegion = csvData[i]; //the current region
        var csvKey = csvRegion.SOV_A3; //the CSV primary key

        //loop through geojson regions to find correct region
        for (var a=0; a<europeRegions.length; a++){

            var geojsonProps = europeRegions[a].properties; //the current region geojson properties
            var geojsonKey = geojsonProps.SOV_A3; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){

                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvRegion[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                });
            };
        };
    };
	
	return europeRegions
};



function setEnumerationUnits(europeRegions, map, path, colorScale){
	//add France regions to map
        var regions = map.selectAll(".regions")
            .data(europeRegions)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "regions " + d.properties.SOV_A3;
            })
            .attr("d", path)
			.style("fill", function(d){
                return choropleth(d.properties, colorScale);
            })
            .on("mouseover", function(d){
                highlight(d.properties);
            })
            .on("mouseout", function(d){
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);
    
        var desc = regions.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');
        
	
};	

function makeColorScale(data){
    var colorClasses = [
        "#fef0d9",
        "#fdcc8a",
        "#fc8d59",
        "#e34a33",
        "#b30000"
    ];

    //create color scale generator
    var colorScale = d3.scaleThreshold()
        .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i=0; i<data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
    
    
    
};
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};
    
function setChart(csvData, colorScale){

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight-5)
        .attr("class", "chart");

    //create a rectangle for chart background fill
    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
    
   
    
    var bars = chart.selectAll(".bar")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return b[expressed]-a[expressed]
        })
        .attr("class", function(d){
            return "bar " + d.SOV_A3;
        })
        .attr("width", chartInnerWidth / csvData.length - 1)
        .on("mouseover", highlight)
        .on("mouseout", dehighlight)
        .on("mousemove", moveLabel);
    
    var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');
		
        
    
     
    
    //create a text element for the chart title
     var chartTitle = chart.append("text")
        .attr("x", 70)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text("Number of " + expressed + " immigrants in each country (thousands)");


    //create vertical axis generator
    var yAxis = d3.axisLeft(yScale)
        .scale(yScale);
    
    
   
    
        

    //place axis
    var axis = chart.append("g")
        .attr("class", "axis")
        .attr("transform", translate)
        .call(yAxis);

    //create frame for chart border
    var chartFrame = chart.append("rect")
        .attr("class", "chartFrame")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);
   
    updateChart(bars, csvData.length, colorScale);
        
};

function updateChart(bars, n, colorScale){
    //position bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        .attr("height", function(d, i){
            return 463 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale);
        })
    var chartTitle = d3.select(".chartTitle")
    .text("Number of " + expressed + " immigrants in each country (thousands)");

    
     
     
};
    
function createDropdown(csvData){
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });

    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(attrArray)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return d });
};

function changeAttribute(attribute, csvData){
    //change the expressed attribute
    expressed = attribute;
    
    //dynamic yaxis
    var changeArray = [];
    for (var i = 0; i < csvData.length; i++) {
        var val = parseFloat(csvData[i][expressed]);
        changeArray.push(val);
    }

    var maxValue = d3.max(changeArray);
    var minValue = d3.min(changeArray);

    yScale = d3.scaleLinear()
        .range([chartHeight, 0])
        .domain([0, maxValue]);

    var yAxis = d3.axisLeft()
        .scale(yScale);

    d3.selectAll("g.axis")
        .call(yAxis);


    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var regions = d3.selectAll(".regions")
		.transition()
		.duration(1000)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });
    
	var bars = d3.selectAll(".bar")
        //re-sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
		.transition()
		.delay(function(d, i){
			return i * 20
		})
		.duration(500);
        
		
    
     

     updateChart(bars, csvData.length, colorScale);

};
    
function highlight(props){
    //change stroke
    var selected = d3.selectAll("." + props.SOV_A3)
        .style("stroke", "black")
        
        .style("stroke-width", "2");
    setLabel(props);
};
    
function dehighlight(props){
    var selected = d3.selectAll("." + props.SOV_A3)
        .style("stroke", function(){
            return getStyle(this, "stroke")
        })
       
        .style("stroke-width", function(){
            return getStyle(this, "stroke-width")
        });
        

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
    d3.select(".infolabel")
        .remove();
};
    

    
function setLabel(props){
    //label content
    var labelAttribute = "<h1>" + props[expressed] +
        "</h1><b>" + expressed + "</b>";

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr("class", "infolabel")
        .attr("id", props.SOV_A3 + "_label")
        .html(labelAttribute);

    var regionName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.COUNTRY);
};
    
//Example 2.8 line 1...function to move info label with mouse
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth - 10,
        y2 = d3.event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1; 

    d3.select(".infolabel")
        .style("left", x + "px")
        .style("top", y + "px");
};
    
    
    
})();

