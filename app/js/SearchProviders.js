/**
* Copyright 2016-2021 Sourcepole AG
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/


import yaml from 'js-yaml';
import CoordinatesUtils from 'qwc2/utils/CoordinatesUtils';
import IdentifyUtils from 'qwc2/utils/IdentifyUtils';
import {SearchResultType} from 'qwc2/actions/search';

// When working locally, send requests to proxy at 8888 to prevent CORS issues
const DEV_PROXY_HOST = 'http://localhost:8888';

function coordinatesSearch(text, searchParams, callback) {
    const displaycrs = searchParams.displaycrs || "EPSG:4326";
    const matches = text.match(/^\s*([+-]?\d+\.?\d*)[,\s]\s*([+-]?\d+\.?\d*)\s*$/);
    const items = [];
    if (matches && matches.length >= 3) {
        const x = parseFloat(matches[1]);
        const y = parseFloat(matches[2]);
        if (displaycrs !== "EPSG:4326") {
            items.push({
                id: "coord0",
                text: x + ", " + y + " (" + displaycrs + ")",
                x: x,
                y: y,
                crs: displaycrs,
                bbox: [x, y, x, y]
            });
        }
        if (x >= -180 && x <= 180 && y >= -90 && y <= 90) {
            const title = Math.abs(x) + (x >= 0 ? "°E" : "°W") + ", "
                + Math.abs(y) + (y >= 0 ? "°N" : "°S");
            items.push({
                id: "coord" + items.length,
                text: title,
                x: x,
                y: y,
                crs: "EPSG:4326",
                bbox: [x, y, x, y]
            });
        }
        if (x >= -90 && x <= 90 && y >= -180 && y <= 180 && x !== y) {
            const title = Math.abs(y) + (y >= 0 ? "°E" : "°W") + ", "
                + Math.abs(x) + (x >= 0 ? "°N" : "°S");
            items.push({
                id: "coord" + items.length,
                text: title,
                x: y,
                y: x,
                crs: "EPSG:4326",
                bbox: [y, x, y, x]
            });
        }
    }
    const results = [];
    if (items.length > 0) {
        results.push(
            {
                id: "coords",
                titlemsgid: "search.coordinates",
                items: items
            }
        );
    }
    callback({results: results});
}

/** ************************************************************************ **/

class NominatimSearch {
    static TRANSLATIONS = {};
    
    static search(text, searchParams, callback, axios) {
        const viewboxParams = {};
        if (searchParams.filterBBox) {
            viewboxParams.viewbox = CoordinatesUtils.reprojectBbox(searchParams.filterBBox, searchParams.mapcrs, "EPSG:4326").join(",");
            viewboxParams.bounded = 1;
        }
        axios.get("https://nominatim.openstreetmap.org/search", {params: {
                'q': text,
                'addressdetails': 1,
                'polygon_geojson': 1,
                'limit': 20,
                'format': 'json',
                'accept-language': searchParams.lang,
                ...viewboxParams,
                ...(searchParams.cfgParams || {})
            }}).then(response => {
            const locale = searchParams.lang;
            if (NominatimSearch.TRANSLATIONS[locale] === undefined) {
                NominatimSearch.TRANSLATIONS[locale] = {promise: NominatimSearch.loadLocale(locale, axios)};
                NominatimSearch.TRANSLATIONS[locale].promise.then(() => {
                    NominatimSearch.parseResults(response.data, NominatimSearch.TRANSLATIONS[locale].strings, callback);
                });
            } else if (NominatimSearch.TRANSLATIONS[locale].promise) {
                NominatimSearch.TRANSLATIONS[locale].promise.then(() => {
                    NominatimSearch.parseResults(response.data, NominatimSearch.TRANSLATIONS[locale].strings, callback);
                });
            } else if (NominatimSearch.TRANSLATIONS[locale].strings) {
                NominatimSearch.parseResults(response.data, NominatimSearch.TRANSLATIONS[locale].strings, callback);
            }
        });
    }
    static parseResults(obj, translations, callback) {
        const results = [];
        const groups = {};
        let groupcounter = 0;
        
        (obj || []).map(entry => {
            if (!(entry.class in groups)) {
                let title = entry.type;
                try {
                    title = translations[entry.class][entry.type];
                } catch (e) {
                    /* pass */
                }
                groups[entry.class] = {
                    id: "nominatimgroup" + (groupcounter++),
                    // capitalize class
                    title: title,
                    items: []
                };
                results.push(groups[entry.class]);
            }
            
            // shorten display_name
            let text = entry.display_name.split(', ').slice(0, 3).join(', ');
            // map label
            const label = text;
            
            // collect address fields
            const address = [];
            if (entry.address.town) {
                address.push(entry.address.town);
            }
            if (entry.address.city) {
                address.push(entry.address.city);
            }
            if (entry.address.state) {
                address.push(entry.address.state);
            }
            if (entry.address.country) {
                address.push(entry.address.country);
            }
            if (address.length > 0) {
                text += "<br/><i>" + address.join(', ') + "</i>";
            }
            
            // reorder coords from [miny, maxy, minx, maxx] to [minx, miny, maxx, maxy]
            const b = entry.boundingbox.map(coord => parseFloat(coord));
            const bbox = [b[2], b[0], b[3], b[1]];
            
            groups[entry.class].items.push({
                id: entry.place_id,
                // shorten display_name
                text: text,
                label: label,
                bbox: bbox,
                geometry: entry.geojson,
                x: 0.5 * (bbox[0] + bbox[2]),
                y: 0.5 * (bbox[1] + bbox[3]),
                crs: "EPSG:4326",
                provider: "nominatim"
            });
        });
        callback({results: results});
    }
    static loadLocale(locale, axios) {
        return new Promise((resolve) => {
            axios.get('https://raw.githubusercontent.com/openstreetmap/openstreetmap-website/master/config/locales/' + locale + '.yml')
            .then(resp2 => {
                NominatimSearch.TRANSLATIONS[locale] = {strings: NominatimSearch.parseLocale(resp2.data, locale)};
                resolve(true);
            }).catch(() => {
                NominatimSearch.TRANSLATIONS[locale] = {
                    promise: axios.get('https://raw.githubusercontent.com/openstreetmap/openstreetmap-website/master/config/locales/' + locale.slice(0, 2) + '.yml')
                    .then(resp3 => {
                        NominatimSearch.TRANSLATIONS[locale] = {strings: NominatimSearch.parseLocale(resp3.data, locale.slice(0, 2))};
                        resolve(true);
                    }).catch(() => {
                        NominatimSearch.TRANSLATIONS[locale] = {strings: {}};
                        resolve(true);
                    })
                };
            });
        });
    }
    static parseLocale(data, locale) {
        const doc = yaml.load(data, {json: true});
        try {
            return doc[locale].geocoder.search_osm_nominatim.prefix;
        } catch (e) {
            return {};
        }
    }
}

/** ************************************************************************ **/

class QgisSearch {
    
    static search(text, searchParams, callback, axios) {
        
        const filter = {...searchParams.cfgParams.expression};
        const values = {TEXT: text};
        const params = {
            SERVICE: 'WMS',
            VERSION: searchParams.theme.version,
            REQUEST: 'GetFeatureInfo',
            CRS: searchParams.theme.mapCrs,
            WIDTH: 100,
            HEIGHT: 100,
            LAYERS: [],
            FILTER: [],
            WITH_MAPTIP: false,
            WITH_GEOMETRY: true,
            feature_count: searchParams.cfgParams.featureCount || 100,
            info_format: 'text/xml'
        };
        Object.keys(filter).forEach(layer => {
            Object.entries(values).forEach(([key, value]) => {
                filter[layer] = filter[layer].replaceAll(`$${key}$`, value.replace("'", "\\'"));
            });
            params.LAYERS.push(layer);
            params.FILTER.push(layer + ":" + filter[layer]);
        });
        params.QUERY_LAYERS = params.LAYERS = params.LAYERS.join(",");
        params.FILTER = params.FILTER.join(";");
        axios.get(searchParams.theme.featureInfoUrl, {params}).then(response => {
            callback(QgisSearch.searchResults(
                IdentifyUtils.parseResponse(response.data, searchParams.theme, 'text/xml', null, searchParams.mapcrs),
                searchParams.cfgParams.title, searchParams.cfgParams.resultTitle
            ));
        }).catch(() => {
            callback({results: []});
        });
    }
    static searchResults(features, title, resultTitle) {
        const results = [];
        Object.entries(features).forEach(([layername, layerfeatures]) => {
            const items = layerfeatures.map(feature => {
                const values = {
                    ...feature.properties,
                    id: feature.id,
                    layername: layername
                };
                return {
                    id: "qgis." + layername + "." + feature.id,
                    text: resultTitle ? resultTitle.replace(/{([^}]+)}/g, match => values[match.slice(1, -1)]) : feature.displayname,
                    x: 0.5 * (feature.bbox[0] + feature.bbox[2]),
                    y: 0.5 * (feature.bbox[1] + feature.bbox[3]),
                    crs: feature.crs,
                    bbox: feature.bbox,
                    geometry: feature.geometry
                };
            });
            results.push(
                {
                    id: "qgis." + layername,
                    title: title + ": " + layername,
                    items: items
                }
            );
        });
        return {results};
    }
    static getResultGeometry(resultItem, callback) {
        callback({geometry: resultItem.geometry, crs: resultItem.crs});
    }
}

/** ************************************************************************ **/

function geoAdminLocationSearch(text, searchParams, callback, axios) {
    const viewboxParams = {};
    if (searchParams.filterBBox) {
        viewboxParams.bbox = window.qwc2.CoordinatesUtils.reprojectBbox(searchParams.filterBBox, searchParams.mapcrs, "EPSG:2056").map(x => Math.round(x)).join(",");
    }
    const params = {
        searchText: text,
        type: "locations",
        limit: 20,
        sr: 2056,
        ...viewboxParams,
        ...(searchParams.cfgParams || {})
    };
    const url = "https://api3.geo.admin.ch/rest/services/api/SearchServer";
    axios.get(url, {params}).then(response => {
        const categoryMap = {
            gg25: "Municipalities",
            kantone: "Cantons",
            district: "Districts",
            sn25: "Places",
            zipcode: "Zip Codes",
            address: "Address",
            gazetteer: "General place name directory"
        };
        const parseItemBBox = (bboxstr) => {
            try {
                const matches = bboxstr.match(/^BOX\s*\(\s*(\d+\.?\d*)\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*(\d+\.?\d*)\s*\)$/);
                return matches.slice(1, 5).map(x => parseFloat(x));
            } catch (e) {
                return null;
            }
        };
        const resultGroups = {};
        (response.data.results || []).map(entry => {
            if (resultGroups[entry.attrs.origin] === undefined) {
                resultGroups[entry.attrs.origin] = {
                    id: entry.attrs.origin,
                    title: categoryMap[entry.attrs.origin] || entry.attrs.origin,
                    items: []
                };
            }
            const x = entry.attrs.y;
            const y = entry.attrs.x;
            resultGroups[entry.attrs.origin].items.push({
                id: entry.id,
                text: entry.attrs.label,
                x: x,
                y: y,
                crs: "EPSG:2056",
                bbox: parseItemBBox(entry.attrs.geom_st_box2d) || [x, y, x, y]
            });
        });
        const results = Object.values(resultGroups);
        callback({results: results});
    });
}

/** ************************************************************************ **/

function hydrantSearch(text, searchParams, callback, axios){
    let results = [];

    // If it is a local installation (i.e. running with yarn development server)
    // I have to change the url to the actual QGIS server url.
    let host = '';
    if (window.location.host == 'localhost:8080') {
        host = DEV_PROXY_HOST;
    }

    // I use format xml instead of json because json responses seem to be very bugged in QGIS server
    axios.get(host + "/ows/search?SERVICE=WFS&REQUEST=GetFeature&CRS=EPSG:2056&OUTPUTFORMAT=text/xml&TYPENAME=hydrants&EXP_FILTER=%22name_nummer%22="+text).then(response => {

        let parser = new DOMParser();
        let xmlDoc = parser.parseFromString(response.data, "text/xml");

        if (xmlDoc.getElementsByTagName("qgs:geometry").length > 0){
            let coordinates = xmlDoc.getElementsByTagName("coordinates")[0].childNodes[0].nodeValue.split(',');
            //let druckzone = xmlDoc.getElementsByTagName("qgs:druckzone")[0].childNodes[0].nodeValue;

            results.push({
                id: "hydrant",
                title: "Hydrant",
                items: [{
                    type: SearchResultType.PLACE,
                    id: 1,
                    text: "Hydrant nr. " + text,
                    label: "Hydrant Nr: " + text,
                    x: parseFloat(coordinates[0]),
                    y: parseFloat(coordinates[1]),
                    crs: 'EPSG:2056',
                    provider: 'hydrants'
                }]
            });
        }

        callback({results: results});
    });
}

///////////////////////////////////////////////////////////////////////////////

function propertySearch(text, searchParams, callback, axios){
    let results = [];

    // If it is a local installation (i.e. running with yarn development server)
    // I have to change the url to the actual QGIS server url.
    let host = '';
    if (window.location.host == 'localhost:8080') {
        host = DEV_PROXY_HOST;
    }

    // I use format xml instead of json because json responses seem to be very bugged in QGIS server
    axios.get(host + "/ows/search?SERVICE=WFS&REQUEST=GetFeature&CRS=EPSG:2056&OUTPUTFORMAT=text/xml&GEOMETRYNAME=centroid&TYPENAME=liegenschaft&EXP_FILTER=\"nummer\"="+text+" OR egris_egrid='"+text+"'").then(response => {

        let parser = new DOMParser();
        let xmlDoc = parser.parseFromString(response.data, "text/xml");
        if (xmlDoc.getElementsByTagName("qgs:geometry").length > 0){
            let coordinates = xmlDoc.getElementsByTagName("coordinates")[0].childNodes[0].nodeValue.split(',');
            let number = xmlDoc.getElementsByTagName("qgs:nummer")[0].childNodes[0].nodeValue;
            let egrid = xmlDoc.getElementsByTagName("qgs:egris_egrid")[0].childNodes[0].nodeValue;

            results.push({
                id: "property",
                title: "Liegenschaft",
                items: [{
                    type: SearchResultType.PLACE,
                    id: 1,
                    text: "Nummer: " + number + ", EGRID: " + egrid,
                    label: "Liegenschaft nr: " + number,
                    x: parseFloat(coordinates[0]),
                    y: parseFloat(coordinates[1]),
                    crs: 'EPSG:2056'
                }]
            });
        }
        
        callback({results: results});
    });
}

///////////////////////////////////////////////////////////////////////////////

function entranceSearch(text, searchParams, callback, axios){
    let results = [];

    // If it is a local installation (i.e. running with yarn development server)
    // I have to change the url to the actual QGIS server url.
    let host = '';
    if (window.location.host == 'localhost:8080') {
        host = DEV_PROXY_HOST;
    }

    // I use format xml instead of json because json responses seem to be very bugged in QGIS server
    axios.get(host + "/ows/search?SERVICE=WFS&REQUEST=GetFeature&CRS=EPSG:2056&OUTPUTFORMAT=text/xml&GEOMETRYNAME=centroid&TYPENAME=gebaeudeeingang&EXP_FILTER=\"gebaeudenummer\"='"+text+"' OR \"gwr_egid\"="+text).then(response => {

        let parser = new DOMParser();
        let xmlDoc = parser.parseFromString(response.data, "text/xml");
        if (xmlDoc.getElementsByTagName("qgs:geometry").length > 0){
            let coordinates = xmlDoc.getElementsByTagName("coordinates")[0].childNodes[0].nodeValue.split(',');
            let number = xmlDoc.getElementsByTagName("qgs:gebaeudenummer")[0].childNodes[0].nodeValue;
            let egid = xmlDoc.getElementsByTagName("qgs:gwr_egid")[0].childNodes[0].nodeValue;

            results.push({
                id: "property",
                title: "Gebäudeeingang",
                items: [{
                    type: SearchResultType.PLACE,
                    id: 1,
                    text: "Nummer: " + number + ", egid: " + egid,
                    label: "Gebäudeeingang nr: " + number,
                    x: parseFloat(coordinates[0]),
                    y: parseFloat(coordinates[1]),
                    crs: 'EPSG:2056',
                }]
            });
        }
        
        callback({results: results});
    });
}

///////////////////////////////////////////////////////////////////////////////



export const SearchProviders = {
    coordinates: {
        labelmsgid: "search.coordinates",
        onSearch: coordinatesSearch,
        handlesGeomFilter: false
    },
    geoadmin: {
        label: "Swisstopo",
        onSearch: geoAdminLocationSearch
    },
    nominatim: {
        label: "OpenStreetMap",
        onSearch: NominatimSearch.search,
        handlesGeomFilter: false
    },
    qgis: {
        label: "QGIS",
        onSearch: QgisSearch.search,
        getResultGeometry: QgisSearch.getResultGeometry,
        handlesGeomFilter: false
    },
    hydrants: {
        label: "Hydranten",
        onSearch: hydrantSearch,
        handlesGeomFilter: false
    },
    properties: {
        label: "Liegenschaft",
        onSearch: propertySearch,
        handlesGeomFilter: false
    },
    entrances: {
        label: "Gebäudeeingang",
        onSearch: entranceSearch,
        handlesGeomFilter: false
    },
};

