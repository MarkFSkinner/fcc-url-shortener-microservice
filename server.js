'use strict';

const express = require('express');
const mongo = require('mongodb');
const mongoose = require('mongoose');

const cors = require('cors');
const dns = require('dns');
const util = require('util');

const app = express();

// Basic Configuration 
const port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
mongoose.connect(process.env.MONGOLAB_URI);

app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
const bodyParser = require('body-parser');

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

const Schema = mongoose.Schema;

const urlSchema = new Schema({
  url: {type: String, required: true, unique: true},
  short: {type: String, required: true, unique: true}
});

const Url = mongoose.model("Url", urlSchema, "urls");

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

  
// your first API endpoint... 
app.get("/api/hello", (req, res) => {
  res.json({greeting: 'hello API'});
});


const lookup = util.promisify(dns.lookup);

const checkUrlFormat = (url) => {
  const regex = /^(http(s)?:\/\/.)(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g;
  return regex.test(url);
};

const getHostname = (url) => {
  const hostnameStart = url.indexOf("/") + 2;
  const urlPartial = url.slice(hostnameStart);
  const hostnameEnd = urlPartial.indexOf("/") !== -1 ? urlPartial.indexOf("/") : urlPartial.length;
  const hostname = urlPartial.slice(0, hostnameEnd);
  return hostname;
};

app.post("/api/shorturl/new", async (req, res) => {
  //check url format is correct with regex
  const url = req.body.url;
  const urlTest = checkUrlFormat(url);
  if (!urlTest) {
    return res.json({"error": "Invalid URL"});
  }
  //check url has a valid hostname with dns.lookup
  const hostname = getHostname(url);
  try {
    await lookup(hostname);
  } catch (err) {
    return res.json({"error": "Hostname Error"});
  }
  //Check if url already in db
  try {
    let dbEntry = await Url.findOne({url: url}).exec();
    //if yes, return it
    if (dbEntry !== null) {
      return res.json({url: dbEntry.url, short: dbEntry.short});
    }
    //if no, create new url entry & save to db
    const shortUrl = Math.floor(Math.random() * 1000000);
    const urlData = {
      url: url,
      short: shortUrl
    };
    const data = new Url(urlData);
    try {
      await data.save();
    } catch (err) {
      if (err.code === 11000) {
        //In case multiple users attempt to enter the same unsaved url at the same time
        dbEntry = await Url.findOne({url: url}).exec();
        return res.json({url: dbEntry.url, short: dbEntry.short});
      } else {
        throw err;
      }
    }
    return res.json(urlData);
  } catch (err) {
    res.send("Database error: " + err);
  }
});

app.get("/api/shorturl/:urlShort", (req, res) => {
  const urlShort = req.params.urlShort;
  Url.findOne({short: urlShort}, (err, data) => {
    if (err) {
      return res.send("Error reading to database");
    }
    res.redirect(data.url);
  });  
});

app.listen(port, function () {
  console.log('Node.js listening ...');
});