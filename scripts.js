const apiKeyInput = document.getElementById('apiKey');
const saveKeyButton = document.getElementById('saveKeyButton');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const resultsContainer = document.getElementById('resultsContainer');
const collectionList = document.getElementById('collectionList');
const collectionStatus = document.getElementById('collectionStatus');
const searchStatus = document.getElementById('searchStatus');
const keyStatus = document.getElementById('keyStatus');
const STORAGE_KEY = 'legoMinifigTracker';
const STORAGE_API_KEY = 'rebrickableApiKey';

let collection = [];
let apiKey = '';

function loadState() {
  apiKey = localStorage.getItem(STORAGE_API_KEY) || '';
  if (apiKey) {
    apiKeyInput.value = apiKey;
    keyStatus.textContent = 'API key loaded. Search and add minifigs.';
  } else {
    keyStatus.textContent = 'Please enter your Rebrickable API key to use the search feature.';
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  collection = saved ? JSON.parse(saved) : [];
  collection = collection.map((entry) => ({
    ...entry,
    quantity: Number.isFinite(Number(entry.quantity)) ? Number(entry.quantity) : 1,
  }));
  renderCollection();

  (async () => {
    if (!apiKey) return;
    let changed = false;
    for (let i = 0; i < collection.length; i++) {
      const e = collection[i];
      if (!e.setYear) {
        try {
          const sets = await fetchMinifigSets(e.set_num);
          const first = sets.results?.[0];
          let year = first?.year || null;
          if (!year && first?.set_num) {
            const detail = await fetchSetDetail(first.set_num);
            year = detail?.year || null;
          }
          if (year) {
            e.setYear = year;
            changed = true;
          }
        } catch (_) {
          // ignore
        }
      }
    }
    if (changed) {
      saveCollection();
      renderCollection();
    }
  })();
}

function saveApiKey() {
  apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    keyStatus.textContent = 'Enter a valid API key before saving.';
    return;
  }
  localStorage.setItem(STORAGE_API_KEY, apiKey);
  keyStatus.textContent = 'API key saved and ready to use.';
}

function saveCollection() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
}

function renderCollection() {
  collectionList.innerHTML = '';
  if (collection.length === 0) {
    collectionStatus.textContent = 'No minifigs tracked yet. Add one from search results.';
    return;
  }

  collectionStatus.textContent = `${collection.length} tracked minifig${collection.length === 1 ? '' : 's'}.`;
  collection.forEach((entry, index) => {
    const li = document.createElement('li');

    if (entry.imageUrl) {
      const image = document.createElement('img');
      image.src = entry.imageUrl;
      image.alt = entry.name;
      image.className = 'collection-item-img';
      li.appendChild(image);
    }

    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `${entry.name} (${entry.set_num})`;
    details.appendChild(title);

    const setLink = document.createElement('a');
    setLink.href = entry.detailUrl || '#';
    setLink.target = '_blank';
    setLink.rel = 'noopener';
    setLink.textContent = entry.setName || 'Unknown set';
    details.appendChild(setLink);

    const yearSmall = document.createElement('small');
    yearSmall.textContent = `Year: ${entry.setYear || 'N/A'}`;
    details.appendChild(yearSmall);

    const qtySmall = document.createElement('small');
    qtySmall.textContent = `Qty: ${entry.quantity || 1}`;
    details.appendChild(qtySmall);

    const setBadge = document.createElement('div');
    setBadge.className = 'badge';
    const setBadgeLink = document.createElement('a');
    setBadgeLink.href = entry.detailUrl || '#';
    setBadgeLink.target = '_blank';
    setBadgeLink.rel = 'noopener';
    setBadgeLink.textContent = `From ${entry.setName || 'set'}`;
    setBadge.appendChild(setBadgeLink);
    details.appendChild(setBadge);

    li.appendChild(details);

    const actionGroup = document.createElement('div');
    actionGroup.style.display = 'flex';
    actionGroup.style.flexDirection = 'column';
    actionGroup.style.gap = '8px';

    const qtyRow = document.createElement('div');
    qtyRow.style.display = 'flex';
    qtyRow.style.alignItems = 'center';
    qtyRow.style.gap = '6px';

    const minusButton = document.createElement('button');
    minusButton.textContent = '-';
    minusButton.type = 'button';
    minusButton.addEventListener('click', () => {
      entry.quantity = Math.max(1, (Number(entry.quantity) || 1) - 1);
      saveCollection();
      renderCollection();
    });

    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '1';
    qtyInput.value = String(entry.quantity || 1);
    qtyInput.style.width = '64px';
    qtyInput.style.textAlign = 'center';
    qtyInput.addEventListener('change', () => {
      const nextValue = Math.max(1, Number(qtyInput.value) || 1);
      entry.quantity = nextValue;
      saveCollection();
      renderCollection();
    });

    const plusButton = document.createElement('button');
    plusButton.textContent = '+';
    plusButton.type = 'button';
    plusButton.addEventListener('click', () => {
      entry.quantity = (Number(entry.quantity) || 1) + 1;
      saveCollection();
      renderCollection();
    });

    qtyRow.appendChild(minusButton);
    qtyRow.appendChild(qtyInput);
    qtyRow.appendChild(plusButton);
    actionGroup.appendChild(qtyRow);

    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => {
      collection.splice(index, 1);
      saveCollection();
      renderCollection();
    });
    actionGroup.appendChild(removeButton);
    li.appendChild(actionGroup);
    collectionList.appendChild(li);
  });
}

function getHeaders() {
  return {
    Authorization: `key ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

async function fetchMinifigs(query) {
  if (!apiKey) {
    throw new Error('API key is required. Save it first.');
  }
  const url = new URL('https://rebrickable.com/api/v3/lego/minifigs/');
  url.searchParams.set('search', query);
  url.searchParams.set('page_size', '30');

  const response = await fetch(url.toString(), {
    headers: getHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || response.statusText || 'Search failed.');
  }
  return response.json();
}

async function fetchMinifigSets(setNum) {
  if (!apiKey) {
    throw new Error('API key is required. Save it first.');
  }
  const url = new URL(`https://rebrickable.com/api/v3/lego/minifigs/${encodeURIComponent(setNum)}/sets/`);
  url.searchParams.set('page_size', '20');

  const response = await fetch(url.toString(), {
    headers: getHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || response.statusText || 'Failed to load sets.');
  }
  return response.json();
}

async function fetchSetDetail(setNum) {
  if (!apiKey) throw new Error('API key is required. Save it first.');
  const url = new URL(`https://rebrickable.com/api/v3/lego/sets/${encodeURIComponent(setNum)}/`);
  const response = await fetch(url.toString(), { headers: getHeaders() });
  if (!response.ok) {
    return null;
  }
  return response.json();
}

function createResultCard(minifig) {
  const container = document.createElement('div');
  container.className = 'card';

  const heading = document.createElement('h2');
  const headingLink = document.createElement('a');
  headingLink.href = `https://rebrickable.com/minifigs/${minifig.set_num}/`;
  headingLink.target = '_blank';
  headingLink.rel = 'noopener';
  headingLink.textContent = `${minifig.name} (${minifig.set_num})`;
  heading.appendChild(headingLink);
  container.appendChild(heading);

  if (minifig.set_img_url) {
    const img = document.createElement('img');
    img.src = minifig.set_img_url;
    img.alt = minifig.name;
    img.className = 'minifig-image';
    container.appendChild(img);
  }

  const year = document.createElement('small');
  year.textContent = `Year: ${minifig.year || 'N/A'}`;
  container.appendChild(year);

  (async () => {
    try {
      const sets = await fetchMinifigSets(minifig.set_num);
      const first = sets.results?.[0];
      if (first) {
        if (first.year) {
          year.textContent = `Year: ${first.year}`;
        } else if (first.set_num) {
          const detail = await fetchSetDetail(first.set_num);
          if (detail?.year) {
            year.textContent = `Year: ${detail.year}`;
          }
        }
      }
    } catch (e) {
      // ignore errors (rate limits or missing key)
    }
  })();

  const button = document.createElement('button');
  button.textContent = 'Add to collection';
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Adding...';
    try {
      const existingIndex = collection.findIndex((item) => item.set_num === minifig.set_num);
      if (existingIndex !== -1) {
        const updatedQty = (Number(collection[existingIndex].quantity) || 1) + 1;
        collection[existingIndex].quantity = updatedQty;
        saveCollection();
        renderCollection();
        searchStatus.textContent = `Already in collection, quantity increased to ${updatedQty}.`;
        button.disabled = false;
        button.textContent = 'Add to collection';
        return;
      }

      const setsData = await fetchMinifigSets(minifig.set_num);
      const firstSet = setsData.results?.[0];
      const setName = firstSet?.name || 'Unknown set';
      let setYear = firstSet?.year || minifig.year || null;
      if (!setYear && firstSet?.set_num) {
        const detail = await fetchSetDetail(firstSet.set_num);
        setYear = detail?.year || setYear;
      }
      collection.push({
        set_num: minifig.set_num,
        name: minifig.name,
        setName,
        setYear,
        quantity: 1,
        imageUrl: minifig.set_img_url || '',
        detailUrl: `https://rebrickable.com/minifigs/${minifig.set_num}/`,
      });
      saveCollection();
      renderCollection();
      searchStatus.textContent = `${minifig.name} added with set "${setName}".`;
    } catch (error) {
      searchStatus.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = 'Add to collection';
    }
  });
  container.appendChild(button);

  return container;
}

async function performSearch() {
  const query = searchInput.value.trim();
  resultsContainer.innerHTML = '';
  if (!query) {
    searchStatus.textContent = 'Type a name or keyword to search minifigs.';
    return;
  }

  searchStatus.textContent = 'Searching Rebrickable...';
  try {
    const data = await fetchMinifigs(query);
    if (!data.results || data.results.length === 0) {
      searchStatus.textContent = 'No minifigs found. Try a different name.';
      return;
    }
    resultsContainer.innerHTML = '';
    data.results.forEach((minifig) => {
      resultsContainer.appendChild(createResultCard(minifig));
    });
    searchStatus.textContent = `Found ${data.count} minifig${data.count === 1 ? '' : 's'}.`;
  } catch (error) {
    searchStatus.textContent = error.message;
  }
}

const pasteKeyButton = document.getElementById('pasteKeyButton');

async function pasteApiKey() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) {
      keyStatus.textContent = 'Clipboard is empty. Copy your key first.';
      return;
    }
    apiKeyInput.value = text.trim();
    keyStatus.textContent = 'API key pasted from clipboard. Click Save API Key.';
  } catch (error) {
    keyStatus.textContent = 'Unable to read clipboard. Paste manually if needed.';
  }
}

saveKeyButton.addEventListener('click', saveApiKey);
pasteKeyButton.addEventListener('click', pasteApiKey);
searchButton.addEventListener('click', performSearch);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    performSearch();
  }
});

loadState();
