const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const Schema = require("./schema");

/**
 * Save processed data to a JSON file
 */
saveToFile = data => {
  fs.writeFile(
    path.join(__dirname, "Data", "formated", "data_v1.json"),
    JSON.stringify(data),
    function(err) {
      if (err) console.log(err);
    }
  );
};
/**
 * Calculate mortality rate for each country
 * @param  {} data  - formated json data
 */
getMortalityRate = data => {
  Object.entries(data).forEach(([country, stats]) => {
    let deaths = stats["total_deaths"];
    let infected = stats["total_infected"];
    let mortalityRate = parseFloat(((deaths * 100) / infected).toFixed(3));
    stats["mortality_rate"] = mortalityRate;
  });
  return data;
};
/**
 * Calculate doubling rate of infection
 * @param  data - formated json data
 * @param  period - period of doubling you want to calculate ex) 5,10 day
 * @param  label - data field to modify
 */
getDoublingTime = (data, period, label) => {
  Object.entries(data).forEach(([country, stats]) => {
    let infected = Object.values(stats["date"]["infected"]);
    let N_t = infected[infected.length - 1];
    let N_0 = infected[infected.length - 1 - 5];
    let growth_rate = parseFloat(
      ((period * Math.log10(2)) / Math.log10(N_t / N_0)).toFixed(3)
    );
    stats[label] = growth_rate;
  });

  return data;
};
/**
 * Modifies the JSON data to include totals for each country
 * Deaths,Infected and Recoveries
 * @param  JSON format data
 */
getTotals = data => {
  Object.entries(data).forEach(([country, stats]) => {
    let infected = Math.max(...Object.values(stats["date"]["infected"]));
    let deaths = Math.max(...Object.values(stats["date"]["deaths"]));
    let recovered = Math.max(...Object.values(stats["date"]["recovered"]));

    stats["total_infected"] = infected;
    stats["total_deaths"] = deaths;
    stats["total_recovered"] = recovered;
  });
  return data;
};
/**
 * Format date to the appropriate JSON structure
 * @param unformated_data - parsed unstructured data parsed from CSV
 * @param formated_data - output structured data
 * @param type - designates the type of unstructured data set
 */
formatData = (unformated_data, formated_data, type) => {
  // Create list of countries within the data
  unformated_data.forEach(element => {
    let country = element["Country/Region"]
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, "_");

    //console.log(country)
    let timedata = formated_data[country]["date"];

    Object.entries(element).forEach(([key, value]) => {
      let dateReg = /^[0-9]{1,2}[/][0-9]{2}[/][0-9]{2}$/g;

      if (dateReg.test(key)) {
        let date = new Date(key).toJSON().split("T")[0];
        if (timedata[[type]] == null) {
          timedata[[type]] = { [date]: parseInt(value) };
        } else if (timedata[[type]][date] == null) {
          timedata[[type]][date] = parseInt(value);
        } else {
          timedata[[type]][date] += parseInt(value);
        }
      }
    });
  });
  return formated_data;
};
/**
 * Read and parse the csv file data
 * @param  {} source - path to CSV file
 */
async function readDataFromSource(source) {
  chunks = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(source)
      .pipe(csv("Province/States", "Country/Region"))
      .on("data", data => chunks.push(data))
      .on("end", () => {
        resolve(chunks);
      });
  });
}
/**
 * Create Json file Blueprint based on schema object
 */
async function createBlueprint(raw, formated) {
  raw.forEach(element => {
    let country = element["Country/Region"]
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, "_");
    formated[country] = new Schema();
  });
  return formated;
}

main = async () => {
  let INFECTED_DATA = [];
  let DEATH_DATA = [];
  let RECOVERED_DATA = [];
  let formated_data = {};

  INFECTED_DATA = await readDataFromSource("./Data/raw/Cases_raw.csv");
  DEATH_DATA = await readDataFromSource("./Data/raw/Death_raw.csv");
  RECOVERED_DATA = await readDataFromSource("./Data/raw/Recovered_raw.csv");

  formated_data = await createBlueprint(INFECTED_DATA, formated_data);

  formated_data = formatData(INFECTED_DATA, formated_data, "infected");
  formated_data = formatData(DEATH_DATA, formated_data, "deaths");
  formated_data = formatData(RECOVERED_DATA, formated_data, "recovered");

  formated_data = getTotals(formated_data);
  formated_data = getDoublingTime(formated_data, 5, "doubling_rate");
  formated_data = getMortalityRate(formated_data);

  saveToFile(formated_data);
};

main();
