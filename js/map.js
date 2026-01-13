const width = 800; // Increase map width for better scaling
const height = 600; // Increase map height for better scaling

const projection = d3.geoMercator()
    .scale(100) // Increase scale to make the continents appear larger
    .center([10, 50]) // Adjust center for better positioning (longitude, latitude)
    .translate([width / 2, height / 2]); // Center the map in the SVG

const path = d3.geoPath().projection(projection);

const typeState = new Map(); // Map to track selected types for each continent

document.querySelectorAll(".continent-section").forEach(section => {
    section.addEventListener("scroll", () => {
        const continent = section.id.replace("-section", ""); // Extract continent from section ID
        const type = typeState.get(continent) || "all"; // Get saved type or default to "all"
        loadData(continent, type); // Reload map with the correct type
    });
});



loadWorldGeoJSON();

function createLegend(typesData) {
    const maxdisasters = d3.max(typesData, d => d.disaster_count) || 1;
    console.log("Max disasters:", maxdisasters);

    const legend = d3.select("#legend")
        .html("") // Clear existing legend
        .append("svg")
        .attr("width", 200)
        .attr("height", 40);

    const legendScale = d3.scaleLinear()
        .domain([0, maxdisasters])
        .range([0, 200]);

    const legendAxis = d3.axisBottom(legendScale)
        .ticks(5)
        .tickFormat(d3.format("d"));

    legend.append("g")
        .attr("transform", "translate(0, 20)")
        .call(legendAxis);
}



function updateMapSize(continent) {
    const mapId = `#${continent.replace("-", "_")}-map`;
    const svg = d3.select(mapId);

    svg
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);
}

function updateProjection(geojson, continent) {
    const bounds = d3.geoPath().bounds(geojson); // Get bounds of the GeoJSON
    const dx = bounds[1][0] - bounds[0][0]; // Width of bounds
    const dy = bounds[1][1] - bounds[0][1]; // Height of bounds
    const xCenter = (bounds[0][0] + bounds[1][0]) / 2; // X center of bounds
    const yCenter = (bounds[0][1] + bounds[1][1]) / 2; // Y center of bounds

    // Base scale and translation (calculated dynamically)
    const baseScale = Math.min(width / dx, height / dy) * 0.8; // Add padding with 0.8 multiplier
    const baseTranslate = [
        width / 2 - baseScale * xCenter,
        height / 2 - baseScale * yCenter,
    ];

    // Continent-specific adjustments
    const continentAdjustments = {
        europe: { scale: 200, translateX: 350, translateY: 125 }, 
        asia: { scale: 55, translateX: 80, translateY: 0 }, // 
        africa: { scale: 50, translateX: 125, translateY: -300 }, 
        north_america: { scale: 45, translateX: -35, translateY: 250 }, 
        south_america: { scale: 50, translateX: 25, translateY: -600 },
        oceania: { scale: 45, translateX: 450, translateY: -850 },
    };

    const adjustment = continentAdjustments[continent] || { scale: 1, translateX: 0, translateY: 0 };

    // Apply adjustments
    const scale = baseScale * adjustment.scale;
    const translate = [
        baseTranslate[0] + adjustment.translateX,
        baseTranslate[1] + adjustment.translateY,
    ];

    // Update projection
    projection
        .scale(scale)
        .translate(translate);
}

// Load data for a specific continent and type
function loadData(continent, type = "all") {
    const formattedContinent = continent.replace("-", "_");
    Promise.all([
        d3.json(`data/geometria/${formattedContinent}.geojson`),
        d3.csv(`data/disasters/disasters_${formattedContinent}.csv`),
        d3.csv(`data/disaster_info/${formattedContinent}_disaster_info.csv`)
    ])
    .then(([geojson, typesData, disasterInfoData]) => {
        console.log(`GeoJSON loaded for ${continent}:`, geojson);
        console.log(`types data loaded for ${continent}:`, typesData);
        console.log(`disaster info data loaded for ${continent}:`, disasterInfoData);

        // Save current type state for the continent
        typeState.set(continent, type);

        createLegend(typesData); // Call legend creation with typesData
        populatetypes(continent, typesData); // Populate dropdown
        updateMap(continent, geojson, typesData, disasterInfoData, type); // Update map with selected type
    })
    .catch(error => {
        console.error(`Error loading data for ${continent}:`, error);
    });
}
// Populate the dropdown with unique types
function populatetypes(continent, typesData) {
    const filter = document.querySelector(`.type-filter[data-continent="${continent}"]`);

    // Get saved type for the continent
    const savedtype = typeState.get(continent) || "all";

    // Extract unique types
    const uniquetypes = Array.from(new Set(typesData.map(d => d.disaster))).sort();

    // Populate the dropdown
    filter.innerHTML = '<option value="all">All Disaster Groups</option>';
    uniquetypes.forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        filter.appendChild(option);
    });

    // Restore saved selection
    if (uniquetypes.includes(savedtype) || savedtype === "all") {
        filter.value = savedtype;
    }

    // Save the selection on change
    filter.addEventListener("change", event => {
        const selectedtype = event.target.value;
        typeState.set(continent, selectedtype); 
        loadData(continent, selectedtype); 
    });
}


// Update the map with filtered data
function updateMap(continent, geojson, typesData, disasterInfoData, type) {

    console.log(`Updating map for ${continent}...`);

    const mapId = `#${continent.replace("-", "_")}-map`;
    const tooltipId = `#${continent.replace("-", "_")}-tooltip`;
    
    const svg = d3.select(mapId);
    const tooltip = d3.select(tooltipId);
    
    const selectedCountryDisplay = document.getElementById(`selected-country-display-${continent}`);
    const selectedCountryName = document.getElementById(`selected-country-name-${continent}`);
    const selectedtype = document.getElementById(`selected-type-info-${continent}`);
    const selecteddisasterNumber = document.getElementById(`selected-disaster-number-${continent}`);
    const disastersListContainer = document.getElementById(`disasters-list-container-${continent}`);
    const closeSelectionBtn = document.getElementById(`close-selection-btn-${continent}`);

    let selectedCountry = null; // Variable to track the currently selected country

    // Update projection dynamically based on geojson and continent-specific adjustments
    updateProjection(geojson, continent);
    svg.selectAll("*").remove(); // Clear previous elements
    const paths = svg.selectAll("path").data(geojson.features);
 
    console.log(`GeoJSON bounds for ${continent}:`, d3.geoPath().bounds(geojson));
    console.log(`Projection scale: ${projection.scale()}, translate: ${projection.translate()}`);
    svg.selectAll("path").each(function (d) {
        console.log(`Path rendered for ${continent}:`, d.properties.name);
 
       })
    console.log("GeoJSON Features:", geojson.features);

    console.log(`Binding ${paths.size()} features to map for ${continent}`); // Log number of features bound

    paths.join("path")
        .attr("d", d3.geoPath().projection(projection))
        .attr("fill", "lightgray") // Temporary color for debugging
        .attr("stroke", "black")
   

    updateMapSize(continent); // Adjust map size dynamically
    
    typesData.forEach(d => {
        d.disaster = d.disaster.trim().toLowerCase();
    });
    

    const filteredtypes = type === "all"
        ? typesData
        : typesData.filter(d => d.disaster === type.trim().toLowerCase());

    const disasterCounts = d3.rollups(
        filteredtypes,
        v => d3.sum(v, d => d.disaster_count),
        d => d.Country.trim().toLowerCase()
    );

    const colormap = d3.interpolateYlOrRd;

    const maxdisasters = d3.max(disasterCounts, d => d[1]) || 1;
    const colorScale = d3.scaleSequential(colormap).domain([0, maxdisasters]);

    // Draw countries
    svg.selectAll("path")
        .data(geojson.features)
        .join("path")
        .attr("d", d3.geoPath().projection(projection))
        .attr("fill", d => {
            const countryName = d.properties.name?.trim().toLowerCase() || "";
            const count = disasterCounts.find(c => c[0] === countryName)?.[1] || 0;
            return count === 0 ? "#d3d3d3" : colorScale(count);
        })
        .attr("stroke", "#000")
        .attr("stroke-width", 0.75)
        .attr("opacity", 0.8)
        .on("mouseover", function (event, d) {
            tooltip.style("display", "block").text(d.properties.name || "Unknown Country");
        })
        .on("mousemove", function (event) {
            const [x, y] = d3.pointer(event);
            tooltip.style("left", `${x + 10}px`).style("top", `${y + 10}px`);
        })
        .on("mouseout", function () {
            tooltip.style("display", "none");
        })
        // Persistent frame for click
        .on("click", function (event, d) {
            // Hide tooltip
            tooltip.style("display", "none");
            
            // Get the selected country and continent
            const countryName = d.properties.name || "Unknown Country";
            selectedCountryName.textContent = countryName;
            selectedtype.textContent = type + ' |'
            selectedCountryDisplay.style.display = "flex";
            
                
            // Load the data for the continent and filter for the country and type
            const disasterFile = `data/disaster_info/${continent}_disaster_info.csv`;
            d3.csv(disasterFile).then(disasterInfoData => {
                // Filter by country and type
                const filtereddisasters = disasterInfoData.filter(disaster => {
                    return (
                        disaster.Country.trim().toLowerCase() === countryName.trim().toLowerCase() &&
                        (type === "all" || disaster.disaster === type)
                    );
                });
                selecteddisasterNumber.textContent = filtereddisasters.length + ' disasters'
                
                console.log('filtered_disasters', filtereddisasters)
                
                
                // Create the HTML list for disasters
                const disastersHTML = filtereddisasters.map(disaster => `
                    <div class="disasters-list-item">
                        <strong>Disaster Type:</strong> ${disaster.disaster_type || "Unknown"}<br>
                        <strong>Event Name:</strong> ${disaster.event_name || "Unknown"}<br>
                        <strong>Deaths:</strong> ${disaster.deaths || "Unknown"}<br>
                        <strong>Affected:</strong> ${disaster.affected || "Unknown"}<br>
                        <strong>Start Event:</strong> ${disaster.start || "Unknown"}<br>
                        <strong>End Event:</strong> ${disaster.end || "Unknown"}
                    </div>
                `).join("");
        
                // Display the filtered disasters
                disastersListContainer.innerHTML = disastersHTML || "<p>No disasters found for this type in this country.</p>";
            }).catch(error => {
                console.error("Error loading disaster data:", error);
                disastersListContainer.innerHTML = "<p>Error loading disasters information.</p>";
            });
        });
// Add the close button listener (attach only once)
// Show the fixed-country-display when a country is clicked
selectedCountryDisplay.style.display = "none";

// Hide it when the close button is clicked
closeSelectionBtn.addEventListener("click", () => {
    selectedCountryDisplay.style.display = "none";
});
}

// Add event listeners to each type filter
document.querySelectorAll(".type-filter").forEach(filter => {
    filter.addEventListener("change", event => {
        const continent = filter.dataset.continent; // Identify continent
        const type = event.target.value; // Get selected type
        console.log(`type selected: ${type} for ${continent}`); // Debug log
        loadData(continent, type); // Reload data with selected type
    });
})

function loadWorldGeoJSON() {
    const continents = ["europe", "asia", "africa", "north_america", "south_america", "oceania"];

    Promise.all(
        continents.map(continent =>
            d3.json(`data/geometria/${continent}.geojson`).then(geojson => ({ continent, geojson }))
        )
    )
    .then(geojsonData => {
        renderWorldMap(geojsonData, "all");
    })
    .catch(error => console.error("Error loading world map data:", error));
}
function getWorldProjection() {
    return d3.geoMercator()
        .scale(230) // Adjust scale for global view
        .translate([860, 560]); // Center the map
}



function renderWorldMap(geojsonData, type = "all") {
    let typesData = null;

    // Load types data
    d3.csv(`data/disasters/disasters_world.csv`).then(data => {
        typesData = data;

        // Normalize and process types data
        typesData.forEach(d => {
            d.disaster_count = +d.disaster_count || 0; // Ensure disaster_count is a number
            d.disaster = d.disaster.trim().toLowerCase(); // Normalize disaster
        });

        // Filter types based on selected type
        const filteredtypes = type === "all"
            ? typesData
            : typesData.filter(d => d.disaster === type.trim().toLowerCase());

        // Aggregate disaster counts by country
        const disasterCounts = d3.rollups(
            filteredtypes,
            v => d3.sum(v, d => d.disaster_count),
            d => d.Country.trim().toLowerCase()
        );

        const colormap = d3.interpolateYlOrRd;

        // Determine max disasters and create color scale
        const maxdisasters = d3.max(disasterCounts, d => d[1]) || 1;
        const colorScale = d3.scaleSequential(colormap).domain([0, maxdisasters]);

        const tooltip = d3.select("#tooltip")

        // Select the world map SVG
        const svg = d3.select("#world-map")
            .attr("width", 1000)
            .attr("height", 800);
        
            svg.selectAll("*").remove(); // Clear previous map

        
        const worldProjection = getWorldProjection();
        const worldPath = d3.geoPath().projection(worldProjection);

        // Render continents with GeoJSON data
        geojsonData.forEach(({ continent, geojson }) => {
            svg.selectAll(`.continent-${continent}`)
                .data(geojson.features)
                .enter()
                .append("path")
                .attr("class", `continent-${continent}`)
                .attr("d", worldPath)
                .attr("fill", d => {
                    const countryName = d.properties.name?.trim().toLowerCase() || "";
                    const count = disasterCounts.find(c => c[0] === countryName)?.[1] || 0;
                    return count === 0 ? "#d3d3d3" : colorScale(count);
                })
                .attr("stroke", "#333")
                .on("mouseover", function (event, d) {
                    tooltip.style("display", "block").text(d.properties.name || "Unknown Country");
                })
                .on("mousemove", function (event) {
                    const [x, y] = d3.pointer(event);
                    tooltip.style("left", `${x + 10}px`).style("top", `${y + 10}px`);
                })
                .on("mouseout", function () {
                    tooltip.style("display", "none");
                })
                .on("click", () => {
                    document.querySelector(`#${continent}-section`).scrollIntoView({ behavior: "smooth" });
                });
        });
    }).catch(error => {
        console.error("Error loading disasters data:", error);
    });
}


d3.csv("data/emdat-data-processed.csv").then(data => {
    const containerWidth = 380;
    const containerHeight = 320;

    // Parse Start Year as number
    data.forEach(d => {
        d["Start Year"] = +d["Start Year"];
    });

    // Get unique years and sort them
    const years = Array.from(new Set(data.map(d => d["Start Year"]))).sort((a, b) => a - b);
    
    // Create year selector before disaster-charts-container
    let yearFilterContainer = d3.select("#year-filter-container");
    if (yearFilterContainer.empty()) {
        // Insert after the h2 title
        const disasterContainer = d3.select("#disaster-charts-container");
        const h2 = disasterContainer.select("h2");
        
        yearFilterContainer = disasterContainer
            .insert("div", "h2 + *")
            .attr("id", "year-filter-container")
            .style("text-align", "center")
            .style("padding", "20px")
            .style("margin-bottom", "20px")
            .style("background-color", "#2c2c2c")
            .style("border-radius", "8px");
        
        yearFilterContainer.append("label")
            .attr("for", "year-selector")
            .style("color", "white")
            .style("font-size", "18px")
            .style("margin-right", "15px")
            .style("font-weight", "bold")
            .text("Filter by Year:");
        
        yearFilterContainer.append("select")
            .attr("id", "year-selector")
            .style("padding", "8px 15px")
            .style("font-size", "16px")
            .style("border-radius", "4px")
            .style("border", "2px solid #4ECDC4")
            .style("background-color", "#1a1a1a")
            .style("color", "white")
            .style("cursor", "pointer");
    }
    
    const selector = d3.select("#year-selector");
    selector.html('<option value="all">All Years</option>');
    years.forEach(year => {
        selector.append("option").attr("value", year).text(year);
    });

    // Handle year selection
    selector.on("change", function () {
        const selectedYear = this.value;
        updateCharts(selectedYear);
    });

    function updateCharts(selectedYear) {
        // Filter data by year
        let filteredData = data;
        if (selectedYear !== "all") {
            filteredData = data.filter(d => d["Start Year"] == selectedYear);
        }

        // Update main title
        const mainTitle = d3.select("#disaster-charts-container h2");
        const yearText = selectedYear === "all" ? "All Years" : `Year ${selectedYear}`;
        mainTitle.text(`Natural Disasters by Continent (${yearText}) 🌍`);

        // Get unique regions (continents)
        const regions = Array.from(new Set(filteredData.map(d => d.Region)));

        // Clear existing charts
        d3.select("#top-row").html("");
        d3.select("#bottom-row").html("");

        // Create histogram for each region
        regions.forEach(region => {
            createRegionHistogram(filteredData, region, selectedYear);
        });
    }

    function createRegionHistogram(filteredData, region, selectedYear) {
        const regionData = filteredData.filter(d => d.Region === region);
        
        // Count disasters by subgroup
        const disasterCounts = d3.rollup(
            regionData,
            v => v.length,
            d => d["Disaster Subgroup"]
        );

        const subgroups = Array.from(disasterCounts.keys()).sort();
        const counts = subgroups.map(sg => disasterCounts.get(sg));

        if (subgroups.length === 0) return; // Skip if no data

        // Create chart container with flex layout for 3 per row
        const chartContainer = d3.select("#top-row").append("div")
            .attr("class", "chart-container")
            .style("flex", "0 0 calc(33.33% - 20px)")
            .style("box-sizing", "border-box")
            .style("margin", "3px")
            .style("background-color", "#1a1a1a")
            .style("padding", "10px")
            .style("border-radius", "8px");

        chartContainer.append("h3")
            .style("color", "white")
            .style("font-size", "20px")
            .style("text-align", "center")
            .style("margin-bottom", "10px")
            .text(region);

        const svg = chartContainer.append("svg")
            .attr("width", containerWidth)
            .attr("height", containerHeight);

        const margin = { top: 20, right: 20, bottom: 100, left: 60 };
        const width = containerWidth - margin.left - margin.right;
        const height = containerHeight - margin.top - margin.bottom;

        const chartGroup = svg.append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        // Create scales
        const xScale = d3.scaleBand()
            .domain(subgroups)
            .range([0, width])
            .padding(0.2);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(counts)])
            .range([height, 0]);

        // Color scale for disaster subgroups - Fixed color mapping
        // Each disaster subgroup has its own specific color
        const disasterColorMap = {
            "Biological": "#00c40a",        // Green
            "Climatological": "#4ECDC4",    // Teal
            "Geophysical": "#45B7D1",       // Blue
            "Hydrological": "#FFA07A",      // Orange
            "Meteorological": "#98D8C8",    // Mint
            "Extra-terrestrial": "#F7DC6F", // Yellow
        };
        
        // Function to get color for a disaster subgroup
        const getDisasterColor = (subgroup) => {
            return disasterColorMap[subgroup] || "#cccccc"; // Gray as fallback
        };
        
        const colorScale = (d) => getDisasterColor(d);

        // Draw bars
        chartGroup.selectAll(".bar")
            .data(subgroups)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => xScale(d))
            .attr("y", d => yScale(disasterCounts.get(d)))
            .attr("width", xScale.bandwidth())
            .attr("height", d => height - yScale(disasterCounts.get(d)))
            .attr("fill", d => colorScale(d))
            .attr("opacity", 0.8)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("opacity", 1);
            })
            .on("mouseout", function(event, d) {
                d3.select(this).attr("opacity", 0.8);
            });

        // Add value labels on bars
        chartGroup.selectAll(".label")
            .data(subgroups)
            .enter()
            .append("text")
            .attr("class", "label")
            .attr("x", d => xScale(d) + xScale.bandwidth() / 2)
            .attr("y", d => yScale(disasterCounts.get(d)) - 5)
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .text(d => disasterCounts.get(d));

        // Add axes
        chartGroup.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(xScale))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end")
            .style("fill", "white")
            .style("font-size", "12px");

        chartGroup.append("g")
            .call(d3.axisLeft(yScale).ticks(5))
            .selectAll("text")
            .style("fill", "white")
            .style("font-size", "12px");

        // Add axis labels
        chartGroup.append("text")
            .attr("transform", "translate(" + (width / 2) + " ," + (height + margin.bottom - 2) + ")")
            .style("fill", "white")
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .text("Disaster Subgroup");

        chartGroup.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -45)
            .attr("x", -height / 2)
            .style("text-anchor", "middle")
            .style("fill", "white")
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .style("font-size", "12px")
            .text("Count");
    }

    // Initial display with all years
    updateCharts("all");
});
