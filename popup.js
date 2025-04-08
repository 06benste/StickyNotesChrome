document.addEventListener('DOMContentLoaded', () => {
  const newNote = document.getElementById('new-note');
  const saveButton = document.getElementById('save-note');
  const notesContainer = document.getElementById('notes-container');
  const showAllButton = document.getElementById('show-all');
  const exportButton = document.getElementById('export-notes');

  let showAll = false; // Track state manually since no checkbox

  // Load notes when the popup opens (default: current URL only)
  loadNotes();

  // Save a new note
  saveButton.addEventListener('click', () => {
    const content = newNote.value.trim();
    if (content) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = new URL(tabs[0].url).hostname;
        saveNote(url, content);
        if (!showAll) {
          const noteElement = createNoteElement(content, url, notesContainer.children.length, true);
          notesContainer.appendChild(noteElement);
        } else {
          loadNotes();
        }
        newNote.value = '';
      });
    }
  });

  // Toggle "Show All Notes" when button is clicked
  showAllButton.addEventListener('click', () => {
    showAll = !showAll; // Toggle state
    showAllButton.textContent = showAll ? 'Show Current Notes' : 'Show All Notes'; // Update button text
    loadNotes(); // Reload notes based on new state
  });

  // Export notes
  exportButton.addEventListener('click', () => {
    chrome.storage.sync.get('notes', (data) => {
      const notes = data.notes || {};
      exportNotes(notes);
    });
  });

  // Function to load and display notes
  function loadNotes() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = new URL(tabs[0].url).hostname;
      chrome.storage.sync.get('notes', (data) => {
        const notes = data.notes || {};
        notesContainer.innerHTML = '';

        for (const [url, noteList] of Object.entries(notes)) {
          if (showAll || url === currentUrl) {
            noteList.forEach((note, index) => {
              const noteElement = createNoteElement(note, url, index, showAll || url === currentUrl);
              notesContainer.appendChild(noteElement);
            });
          }
        }
      });
    });
  }

  // Function to create a note element
  function createNoteElement(note, url, index, showButtons) {
    const noteElement = document.createElement('div');
    noteElement.className = 'note';

    // Add hostname if showing all and not the current URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = new URL(tabs[0].url).hostname;
      if (showAll && url !== currentUrl) {
        const hostnameElement = document.createElement('div');
        hostnameElement.className = 'hostname';
        hostnameElement.textContent = url;
        noteElement.appendChild(hostnameElement);
      }

      const noteText = document.createElement('span');
      noteText.textContent = note;
      noteElement.appendChild(noteText);

      if (showButtons) {
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'edit-btn';
        editBtn.addEventListener('click', () => editNote(url, index, noteElement, noteText));
        noteElement.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', () => deleteNote(url, index));
        noteElement.appendChild(deleteBtn);
      }
    });

    return noteElement;
  }

  // Function to save a note
  function saveNote(url, content) {
    chrome.storage.sync.get('notes', (data) => {
      const notes = data.notes || {};
      notes[url] = notes[url] || [];
      notes[url].push(content);
      chrome.storage.sync.set({ notes }, () => {
        console.log('Note saved for', url);
      });
    });
  }

  // Function to edit a note
  function editNote(url, index, noteElement, noteText) {
    const textarea = document.createElement('textarea');
    textarea.value = noteText.textContent;
    textarea.style.width = '100%';
    textarea.style.height = '60px';
    noteElement.replaceChild(textarea, noteText);

    const editBtn = noteElement.querySelector('.edit-btn');
    const deleteBtn = noteElement.querySelector('.delete-btn');
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'edit-btn';
    noteElement.replaceChild(saveBtn, editBtn);
    noteElement.removeChild(deleteBtn);

    saveBtn.addEventListener('click', () => {
      const updatedContent = textarea.value.trim();
      if (updatedContent) {
        chrome.storage.sync.get('notes', (data) => {
          const notes = data.notes || {};
          if (notes[url] && notes[url][index] !== undefined) {
            notes[url][index] = updatedContent;
            chrome.storage.sync.set({ notes }, () => {
              noteText.textContent = updatedContent;
              noteElement.replaceChild(noteText, textarea);
              noteElement.replaceChild(editBtn, saveBtn);
              noteElement.appendChild(deleteBtn);
            });
          }
        });
      }
    });
  }

  // Function to delete a note
  function deleteNote(url, index) {
    chrome.storage.sync.get('notes', (data) => {
      const notes = data.notes || {};
      if (notes[url]) {
        notes[url].splice(index, 1);
        if (notes[url].length === 0) {
          delete notes[url];
        }
        chrome.storage.sync.set({ notes }, loadNotes);
      }
    });
  }

  // Function to export notes
  function exportNotes(notes) {
    const format = prompt('Export as (txt or csv)?', 'txt');
    if (!format) return;

    let content = '';
    let filename = '';

    if (format.toLowerCase() === 'csv') {
      content = 'Website,Note\n';
      for (const [url, noteList] of Object.entries(notes)) {
        noteList.forEach(note => {
          content += `"${url}","${note.replace(/"/g, '""')}"\n`;
        });
      }
      filename = 'sticky_notes.csv';
    } else {
      for (const [url, noteList] of Object.entries(notes)) {
        content += `${url}:\n`;
        noteList.forEach(note => {
          content += `- ${note}\n`;
        });
        content += '\n';
      }
      filename = 'sticky_notes.txt';
    }

    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
});