/**
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

(function() {
'use strict';

const CSE_ID = '007435387813601113811:dinkwhm2suk';
const API_KEY = 'AIzaSyBHc09TGSyYSK63bUt8wbXtiySDV9PjDZg';

const DEBOUNCE_SEARCH = 350; //ms

const queryInput = document.querySelector('#q');
const searchResults = document.querySelector('#search-results-template');
const autoCompleteTemplate = document.querySelector('#autocomplete-results-template');
const autoComplete = document.querySelector('#autocomplete-results');
const queryResults = document.querySelector('#query-results');
const fadeFixed = document.querySelector('#fade-fixed');

const domains_to_browser = {
  'bugs.chromium.org': 'Chromium',
  'developer.microsoft.com': 'Edge',
  'bugzilla.mozilla.org': 'Mozilla',
  'bugs.webkit.org': 'WebKit'
};

const CLOSED_STATUSES = [
  'RESOLVED',
  'VERIFIED',
  'CLOSED',
  'FIXED',
  'WONTFIX',
  'DUPLICATE',
  'RESOLVED FIXED',
  'RESOLVED WONTFIX',
  'RESOLVED DUPLICATE',
  'VERIFIED FIXED',
  'VERIFIED WONTFIX',
  'VERIFIED DUPLICATE',
  'CLOSED FIXED',
  'CLOSED WONTFIX',
  'CLOSED DUPLICATE'
];

let nextStartIndex;
let prevStartIndex;
let lastResults = {};
let isSearching = false; // True if the user is typing the search input.
let _fetching = false; // True when there's an outstanding query to the CSE API.

const filters = {
  fadeFixed: fadeFixed.checked,
  includeChromium: true,
  includeMozilla: true,
  includeEdge: true,
  includeWebKit: true
};

class Bug {
  constructor(url) {
    this.url = url;
    this.needsCors = false;
  }

  static get CORS_PREFIX() {
    return 'https://crossorigin.me';
  }

  fetchPage(url=this.url) {
    if (this.needsCors) {
      url = `${Bug.CORS_PREFIX}/${url}`;
    }

    return new Promise(function(resolve, reject) {
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'document';
      xhr.open('GET', url, true);
      xhr.onload = function(e) {
        resolve(e.target.response);
      };
      xhr.onerror = reject;
      xhr.send();
    });
  }
}

class CrBug extends Bug {
  constructor(url) {
    super(url);
    this.needsCors = true;
  }

  findStatus(doc) {
    const statusEl = doc.querySelector('#issuemeta');
    if (statusEl) {
      // Status is first <td> of #issuemeta.
      const status = statusEl.querySelector('td');
      if (status) {
        return status.textContent.trim();
      }
    }
    return '';
  }
}

class WebKitBug extends Bug {
  constructor(url) {
    super(url);
  }

  findStatus(doc) {
    const statusEl = doc.querySelector('#static_bug_status');
    if (statusEl) {
      return statusEl.textContent.replace('\n', '')
                                 .replace(/ +(?=)/g, ' ').trim();
    }
    return '';
  }
}

class MozillaBug extends Bug {

  static get BUG_PREFIX() {
    return 'https://bugzilla.mozilla.org/rest/bug/';
  }

  constructor(url) {
    super(url);
    this.needsCors = false;
  }

  fetchPage(url=this.url) {
    let match = url.match(/\?id=(.+)$/);
    if (!match) {
      return Promise.reject('Could not find bug id Mozilla bug link.');
    }

    url = `${MozillaBug.BUG_PREFIX}${match[1]}`;

    return fetch(url).then(resp => resp.json());
  }

  findStatus(json) {
    return json.bugs[0].status;
  }
}

class EdgeBug extends Bug {
  constructor(url) {
    super(url);
    this.needsCors = true;
  }

  findStatus(doc) {
    const statusEl = doc.querySelector('.bug-status');
    if (statusEl) {
      return statusEl.textContent.replace('\n', '')
                                 .replace(/ +(?=)/g, ' ').trim();
    }
    return '';
  }
}

function getQuery() {
  const siteSearch = [];

  if (filters.includeChromium) {
    siteSearch.push('site:bugs.chromium.org');
  }
  if (filters.includeEdge) {
    siteSearch.push('site:developer.microsoft.com');
  }
  if (filters.includeMozilla) {
    siteSearch.push('site:bugzilla.mozilla.org');
  }
  if (filters.includeWebKit) {
    siteSearch.push('site:bugs.webkit.org');
  }

  let q = queryInput.value;
  if (siteSearch.length) {
    q = `${siteSearch.join(' OR ')} ${q}`;
  }

  return q;
}

function doSearch(startIndex=null) {
  if (_fetching) {
    return Promise.reject('Search already in progress');
  }

  resetUI();

  const url = new URL('https://www.googleapis.com/customsearch/v1');

  // Can't use url.searchParams b/c Safari doesn't support it.
  const params = new URLSearchParams(); // url.searchParams;
  params.set('q', getQuery());
  params.set('key', API_KEY);
  params.set('cx', CSE_ID);
  // params.append('excludeTerms', 'Status: Fixed');

  if (startIndex) {
    params.set('start', startIndex);
  }

  url.search = params.toString();

  _fetching = true;
  return fetch(url).then(resp => resp.json()).then(json => {
    _fetching = false;

    if (json.error) {
      throw new Error(json.error.message);
    }
    lastResults = json;
    return lastResults;
  })
  .then(results => formatResults(results))
  .catch(msg => reject(msg));
}

function updateStatus(status, i) {
  searchResults.set(`items.${i}.status`, status);

  if (filters.fadeFixed && CLOSED_STATUSES.includes(status)) {
    searchResults.set(`items.${i}.filterOut`, true);
  }
}

function populateBugStatus(items) {
  const promises = [];

  items.map(function(item, i) {
    switch (item.browser) {
      case 'Chromium':

        let crbug = new CrBug(item.link);
        var p = crbug.fetchPage().then(doc => crbug.findStatus(doc)).then(status => {
          status = status.toUpperCase() || 'Unknown';
          updateStatus(status, i);
        });

        promises.push(p);

        break;
      case 'Edge':
        let edgeBug = new EdgeBug(item.link);
        var p = edgeBug.fetchPage().then(doc => edgeBug.findStatus(doc)).then(status => {
          status = status.toUpperCase();
          updateStatus(status, i);
        });

        promises.push(p);

        break;
      case 'Mozilla':
        let mozillaBug = new MozillaBug(item.link);
        var p = mozillaBug.fetchPage().then(json => mozillaBug.findStatus(json)).then(status => {
          status = status.toUpperCase();
          updateStatus(status, i);
        });

        promises.push(p);

        break;
      case 'WebKit':
        let webkitBug = new WebKitBug(item.link);
        var p = webkitBug.fetchPage().then(doc => webkitBug.findStatus(doc)).then(status => {
          status = status.toUpperCase();
          updateStatus(status, i);
        });

        promises.push(p);

        break;
      default:
        // noop
    }
  });

  // Promise.all(promises).then(list => {
  //   // list.filter(obj => {
  //   //   if (obj && obj.remove) {
  //   //     searchResults.splice('items', obj.idx, 1);
  //   //   }
  //   // });
  // });
}

function populateResultsPage() {
  let results = lastResults;

  updateQueryStats(results);

  if (!results.items) {
    return;
  }

  searchResults.items = results.items;

  if (results.queries.nextPage) {
    nextButton.disabled = false;
    nextStartIndex = results.queries.nextPage[0].startIndex;
  } else {
    nextButton.disabled = true;
  }

  if (results.queries.previousPage) {
    prevButton.disabled = false;
    prevStartIndex = results.queries.previousPage[0].startIndex;
  } else {
    prevButton.disabled = true;
  }

  let url = `?q=${queryInput.value}`;
  const params = new URLSearchParams(location.search);
  if (params.has('embed')) {
    url += '&embed';
  }
  history.pushState({}, '', url);
}

function formatResults(results) {
  const items = results.items;

  if (!items) {
    return;
  }

  items.map(function(item, i) {
    item.status = '';
    item.browser = domains_to_browser[item.displayLink] || item.displayLink;

    let match;

    switch (item.browser) {
      case 'Chromium':
        match = item.title.match(/Issue (\d+) - chromium - (.*) [Monorail]?/i);
        break;
      case 'Mozilla':
        match = item.title.match(/(\d+) – (.*)/i);
        break;
      case 'WebKit':
        match = item.title.match(/Bug (\d+) – (.*)/i);
        break;
      default:
        // noop
    }

    if (match) {
      // Remove trailing " -" from titles.
      item.title = match[2].replace(/ -$/, '');
    }
  });

  autoCompleteTemplate.items = items.slice(0, 5);
  autoComplete.removeAttribute('invisible');

  return results;
}

function updateQueryStats(results) {
  if (!results.searchInformation) {
    return;
  }

  const totalResults = parseInt(results.searchInformation.totalResults) || 0;
  const startIdx = results.queries.request[0].startIndex || 0;
  const num = results.queries.request[0].count;

  queryResults.querySelector('.query-total-results').textContent = totalResults;
  queryResults.querySelector('.query-term').textContent = queryInput.value;
  queryResults.querySelector('.query-page').textContent =
      Math.floor(startIdx / num) + 1;
  queryResults.querySelector('.query-page-total').textContent =
      Math.floor(totalResults / num) + 1;
  queryResults.hidden = false;
}

function resetUI() {
  queryResults.hidden = true;
  searchResults.items = [];
  nextButton.disabled = true;
  prevButton.disabled = true;
  lastResults = {};
}

function lazyLoadWCPolyfillsIfNecessary() {
  const onload = function() {
    // For native Imports, manually fire WCR so user code
    // can use the same code path for native and polyfill'd imports.
    if (!window.HTMLImports) {
      document.dispatchEvent(
          new CustomEvent('WebComponentsReady', {bubbles: true}));
    }
  };

  const webComponentsSupported = (
    'registerElement' in document
    && 'import' in document.createElement('link')
    && 'content' in document.createElement('template'));
  if (!webComponentsSupported) {
    const script = document.createElement('script');
    script.async = true;
    script.src = '/bower_components/webcomponentsjs/webcomponents-lite.min.js';
    script.onload = onload;
    document.head.appendChild(script);
  } else {
    onload();
  }
}

queryInput.addEventListener('input', e => {
  if (e.target.value.length >= 3) {
    autoCompleteTemplate.debounce('search', function() {
      doSearch().then(results => {
        // Wait for some results before showing auto complete panel.
        isSearching = true;
        toggleAutoComplete();
      });
    }, DEBOUNCE_SEARCH);
  } else {
    isSearching = false;
    toggleAutoComplete();
  }
});

queryInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.keyCode === 13 ||
      e.key === 'Escape' || e.keyCode === 2) {
    queryInput.blur(); // kicks off toggleAutoComplete().
    if (!lastResults.items) {
      doSearch().then(results => {
        populateResultsPage();
        populateBugStatus(lastResults.items);
      });
    }
  }
});

function toggleAutoComplete() {
  if (document.activeElement === queryInput && isSearching) {
    autoComplete.hidden = false;
  } else {
    autoComplete.hidden = true;
  }
}

queryInput.addEventListener('focus', function() {
  toggleAutoComplete();
});

queryInput.addEventListener('blur', function(e) {
  // If users clicks auto complete result, don't populate page.
  if (e.relatedTarget) {
    return;
  }

  isSearching = false;
  toggleAutoComplete();
  populateResultsPage();
});

const nextButton = document.querySelector('#next-results-button');
nextButton.addEventListener('click', e => {
  doSearch(nextStartIndex).then(results => {
    populateResultsPage();
    populateBugStatus(lastResults.items);
  });
});

const prevButton = document.querySelector('#prev-results-button');
prevButton.addEventListener('click', e => {
  doSearch(prevStartIndex).then(results => {
    populateResultsPage();
    populateBugStatus(lastResults.items);
  });
});

const resetSearchButton = document.querySelector('.search-reset');
resetSearchButton.addEventListener('click', e => {
  queryInput.value = null;
  resetUI();
  const url = new URL(location);
  url.searchParams.delete('q');
  history.pushState({}, '', url);
});


const filtersEls = document.querySelector('#filters');
filtersEls.addEventListener('change', e => {
  if (!queryInput.value) {
    return;
  }

  switch (e.target.dataset.type) {
    case 'fixed':
      filters.fadeFixed = e.target.checked;
      break;
    case 'chromium':
      filters.includeChromium = e.target.checked;
      break;
    case 'edge':
      filters.includeEdge = e.target.checked;
      break;
    case 'mozilla':
      filters.includeMozilla = e.target.checked;
      break;
    case 'webkit':
      filters.includeWebKit = e.target.checked;
      break;
  }

  // TODO: don't redo search if there are already results on the page.
  // Just update data model.
  doSearch().then(results => {
    populateResultsPage();
    populateBugStatus(lastResults.items);
  });
});

function init() {
  const url = new URL(location);

  // Can't use url.searchParams b/c Safari doesn't support it.
  const params = new URLSearchParams(url.search);
  if (params.has('embed')) {
    document.documentElement.classList.add('embed');
  }

  const doDeepLink = function() {
    const query = params.get('q');
    if (query) {
      queryInput.value = query;
      doSearch().then(results => {
        populateResultsPage();
        populateBugStatus(lastResults.items);
      });
    }
  };

  const htmlImport = document.querySelector('link[rel="import"]');
  if (htmlImport) {
    htmlImport.addEventListener('load', doDeepLink);
  } else {
    doDeepLink();
  }

  lazyLoadWCPolyfillsIfNecessary();
}

init();

})(window);
