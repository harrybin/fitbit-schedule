import * as fs from "fs";
import * as cbor from "cbor";
import { peerSocket } from "messaging";
import { _ } from "../common/locale.js";
import {
  GC_DATA_FILE,
  GC_ERROR_FILE,
  GC_UPDATE_TOKEN,
  MAX_EVENT_COUNT,
  DEBUG,
} from "../common/const";

export default class GCalendar {
  constructor() {
    this.onUpdate = function () {};
    this.onError = function (error) {};
    this._lastUpdate = new Date().getTime();
    DEBUG && console.log("- load Envets from file start -");
    try {
      this._events = fs.readFileSync(GC_DATA_FILE, "cbor");
      if (this._events !== undefined) {
        this._lastUpdate = this._events.lastUpdate;
        //DEBUG: Endable to forth a refetch of the data on every app start
        //        this._lastUpdate = 0;
        //DEBUG: ---------------------------------------------------------
        this._events = this._events.events;
      } else {
        DEBUG && console.log("no cached calendar retrived on load");
      }
    } catch (n) {
      this._lastUpdate = 0;
      this._events = undefined;
    }
    //  this._lastUpdate = 0;
    //  this._events = undefined;
  }

  getLastUpdate() {
    return this._lastUpdate;
  }

  processFile(fileName) {
    DEBUG && console.log("Processing file " + fileName);
    if (fileName === GC_DATA_FILE) {
      let data = fs.readFileSync(GC_DATA_FILE, "cbor");
      DEBUG && console.log("raw data read from file");
      if (data !== undefined) {
        this._events = data.events;
        this._lastUpdate = data.lastUpdate;
        this.onUpdate();
      }
    } else if (fileName === GC_ERROR_FILE) {
      const error = fs.readFileSync(GC_ERROR_FILE, "cbor");
      DEBUG &&
        console.log(`Events read error. ${error} ${JSON.stringify(error)}`);
      this.onError(_("error_get_events", JSON.stringify(error)));
    } else return false;
  }

  getEvents() {
    let ev = this._events;
    let nEv = [];
    const today = new Date().setHours(0, 0, 0, 0);
    for (let i of ev) {
      if (i.end >= today) nEv.push(i);
    }
    if (ev && ev.length !== nEv.length) {
      fs.writeFileSync(
        GC_DATA_FILE,
        cbor.encode({
          events: nEv,
          lastUpdate: this._lastUpdate,
        })
      );
    }
    this._events = nEv;

    return this._events;
  }

  fetchEvents() {
    let now = new Date();
    if (this._events === undefined || now - this._lastUpdate > 10 * 60 * 1000) {
      this.forceFetchEvents();
    }
    return this.getEvents();
  }

  forceFetchEvents() {
    if (peerSocket.readyState === peerSocket.OPEN) {
      // Send a command to the companion
      peerSocket.send({ GC_UPDATE_TOKEN: true });
    } else {
      DEBUG && console.log("No connection with the companion");
      this.onError(_("no_connection_to_companion"));
    }
    return this._events;
  }

  dropEvents() {
    fs.unlinkSync(GC_DATA_FILE);
    this.onUpdate();
  }
}
