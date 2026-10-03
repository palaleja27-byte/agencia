document.addEventListener('DOMContentLoaded', () => {
  const inputOperator = document.getElementById('input-operator');
  const selectShift = document.getElementById('select-shift');
  const selectProfile = document.getElementById('select-profile');
  const btnStart = document.getElementById('btn-start');
  const btnLogout = document.getElementById('btn-logout');
  const statusDiv = document.getElementById('status-container');

  // Cargar datos previos
  chrome.storage.local.get(['operator', 'shift', 'profileName', 'profileId', 'monitoringActive'], (data) => {
    if (data.operator) inputOperator.value = data.operator;
    if (data.shift) selectShift.value = data.shift;
    if (data.profileId) {
      const optById = Array.from(selectProfile.options).find(o => o.getAttribute('data-id') === String(data.profileId));
      if (optById) {
        optById.selected = true;
      } else if (data.profileName) {
        selectProfile.value = data.profileName;
      }
    } else if (data.profileName) {
      selectProfile.value = data.profileName;
    }

    if (data.monitoringActive && statusDiv) {
      statusDiv.innerText = '🟢 Monitoreo Activo en este Turno';
      statusDiv.style.color = '#10b981';
    }
  });

  btnStart.addEventListener('click', () => {
    const selectedOperator = inputOperator.value.trim();
    const selectedShift = selectShift.value;
    const selectedOption = selectProfile.options[selectProfile.selectedIndex];
    const selectedProfileName = selectProfile.value;
    const selectedProfileId = selectedOption ? selectedOption.getAttribute('data-id') : selectedProfileName;

    if (!selectedOperator) {
      alert('Por favor escribe el nombre del operador.');
      return;
    }

    const sessionPayload = {
      operator: selectedOperator,
      shift: selectedShift,
      profileName: selectedProfileName,
      profileId: selectedProfileId,
      monitoringActive: true,
      sessionStartTime: Date.now()
    };

    chrome.storage.local.set(sessionPayload, () => {
      if (statusDiv) {
        statusDiv.innerText = '🟢 Monitoreo Iniciado';
        statusDiv.style.color = '#10b981';
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes('talkytimes.com')) {
          chrome.tabs.reload(tabs[0].id);
        }
      });

      setTimeout(() => window.close(), 300);
    });
  });

  // Botón de Cerrar Sesión en el Popup
  btnLogout.addEventListener('click', () => {
    chrome.storage.local.clear(() => {
      if (statusDiv) {
        statusDiv.innerText = '⚪ Sesión Cerrada';
        statusDiv.style.color = '#f87171';
      }
      inputOperator.value = '';

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes('talkytimes.com')) {
          chrome.tabs.reload(tabs[0].id);
        }
      });

      setTimeout(() => window.close(), 300);
    });
  });
});