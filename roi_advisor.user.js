// ==UserScript==
// @name         OGame ROI Advisor
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Adds a button to OGame to calculate ROI for Mines and Lifeforms, displaying data in a 4-tab modal.
// @author       Patrik Wagner
// @match        https://*.ogame.gameforge.com/game/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // --- Constants & Config ---
    const SCRIPT_ID = 'ogame_roi_advisor';
    const TEAMS = {
        HUMAN: 1,
        ROCKTAL: 2,
        MECHA: 3,
        KAELESH: 4
    };

    // --- Data Fetcher ---
    class DataFetcher {
        constructor() {
            this.empireData = null;
            this.lfBonuses = {};
        }

        async fetchEmpireData() {
            try {
                this.empireData = {};
                // OGLight loops i=0 (Planets) and i=1 (Moons)
                const types = [0, 1];

                const promises = types.map(type =>
                    fetch(`/game/index.php?page=ajax&component=empire&ajax=1&planetType=${type}&asJson=1`, {
                        headers: { "X-Requested-With": "XMLHttpRequest" }
                    })
                        .then(res => res.json())
                        .then(json => {
                            if (json.mergedArray) {
                                // OGLight logic: this.ogl._empire.update(JSON.parse(result.mergedArray), i)
                                // mergedArray parses to { planets: [...] }
                                const parsed = JSON.parse(json.mergedArray);

                                if (parsed && parsed.planets) {
                                    parsed.planets.forEach(p => {
                                        if (p && p.id) {
                                            this.empireData[p.id] = p;
                                        }
                                    });
                                }
                            }
                        })
                        .catch(err => console.error(`ROI Advisor: Error fetching type ${type}`, err))
                );

                await Promise.all(promises);
                console.log('ROI Advisor: Full Empire Data Fetched', this.empireData);
                return this.empireData;
            } catch (error) {
                console.error('ROI Advisor: Critical Error fetching Empire Data', error);
                return null;
            }
        }

        async fetchLFBonuses() {
            try {
                const response = await fetch('/game/index.php?page=ajax&component=lfbonuses');
                const htmlText = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');

                // Logic ported from OGLight to extract bonuses
                // Selects all subcategories or items that have data-toggable attributes
                const items = doc.querySelectorAll("bonus-item-content-holder > [data-toggable]");
                this.lfBonuses = {};

                items.forEach(item => {
                    // Clean ID: "subcategory11101" -> "11101"
                    const dirtyId = item.getAttribute("data-toggable");
                    const id = dirtyId.replace(/subcategory|Ships|Defenses|CostAndTime/g, "");

                    // Extract numeric values from bonus-item elements
                    const bonuses = [];
                    const bonusItems = item.querySelectorAll("bonus-item"); // These usually hold the text like "+5%"

                    if (bonusItems.length > 0) {
                        bonusItems.forEach(bonus => {
                            // Simple regex to find numbers (including negatives and decimals)
                            const text = bonus.innerText;
                            const match = text.match(/[0-9|-]+([.,][0-9]+)?/g);
                            if (match) {
                                const val = parseFloat(match[0].replace(',', '.'));
                                bonuses.push(val);
                            } else {
                                bonuses.push(0);
                            }
                        });
                    } else {
                        // Fallback for items appearing directly without sub-items
                        const text = item.innerText;
                        const match = text.match(/[0-9|-]+([.,][0-9]+)?/g);
                        if (match) {
                            const val = parseFloat(match[0].replace(',', '.'));
                            this.lfBonuses[id] = { bonus: val };
                            return; // Skip array assignment
                        }
                    }

                    // Store based on ID type (simulating OGLight structure roughly)
                    // We really only care about Techs/Buildings here for ROI
                    this.lfBonuses[id] = { raw: bonuses };
                });

                console.log('ROI Advisor: LF Bonuses Fetched', this.lfBonuses);
                return this.lfBonuses;
            } catch (error) {
                console.error('ROI Advisor: Error fetching LF Bonuses', error);
                return null;
            }
        }

        async fetchAll() {
            console.log('ROI Advisor: Fetching all data...');
            await Promise.all([this.fetchEmpireData(), this.fetchLFBonuses()]);
            return {
                empire: this.empireData,
                bonuses: this.lfBonuses
            };
        }
    }

    // --- UI Manager ---
    class UIManager {
        constructor(dataFetcher, calculator) {
            this.dataFetcher = dataFetcher;
            this.calculator = calculator;
            this.modalId = 'roi-advisor-modal';
            this.isOpen = false;
            this.contentContainer = null; // To store the content div for re-rendering
            this.activeTabIndex = 0; // To keep track of the currently active tab
        }

        createButton() {
            const menu = document.querySelector('#menuTable');
            if (!menu) return;

            const buttonContainer = document.createElement('li');
            buttonContainer.className = 'menubutton_table';

            const link = document.createElement('a');
            link.className = 'menubutton';
            link.href = '#';
            link.innerHTML = '<span class="textlabel">ROI Advisor</span>';
            link.onclick = (e) => {
                e.preventDefault();
                this.toggleModal();
            };

            buttonContainer.appendChild(link);
            menu.appendChild(buttonContainer);
        }

        async toggleModal() {
            if (this.isOpen) {
                this.closeModal();
            } else {
                await this.openModal();
            }
        }

        async openModal() {
            // Fetch data before showing
            await this.dataFetcher.fetchAll();

            const modal = document.createElement('div');
            modal.id = this.modalId;
            Object.assign(modal.style, {
                position: 'fixed',
                top: '5%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '90%',
                height: '80%',
                backgroundColor: '#161e2b',
                border: '2px solid #555',
                borderRadius: '10px',
                zIndex: '9999',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 0 20px rgba(0,0,0,0.8)',
                fontSize: '12px'
            });

            // Header
            const header = document.createElement('div');
            Object.assign(header.style, {
                padding: '10px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            });

            const title = document.createElement('h3');
            title.innerText = 'ROI Advisor (v2.1)';
            header.appendChild(title);

            const controls = document.createElement('div');

            // Sync Button
            const syncBtn = document.createElement('button');
            syncBtn.innerText = '↻ Sync Data';
            Object.assign(syncBtn.style, {
                background: '#2d3748',
                border: '1px solid #4a5568',
                color: 'white',
                padding: '5px 10px',
                marginRight: '15px',
                borderRadius: '4px',
                cursor: 'pointer'
            });
            syncBtn.onclick = async () => {
                syncBtn.innerText = 'Syncing...';
                await this.dataFetcher.fetchAll();
                this.renderTabContent(this.contentContainer, this.activeTabIndex || 0);
                syncBtn.innerText = '↻ Sync Data';
            };
            controls.appendChild(syncBtn);

            const closeBtn = document.createElement('button');
            closeBtn.innerText = 'X';
            Object.assign(closeBtn.style, {
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '16px',
                cursor: 'pointer'
            });
            closeBtn.onclick = () => this.closeModal();
            controls.appendChild(closeBtn);

            header.appendChild(controls);
            modal.appendChild(header);

            // Tabs
            const tabsContainer = document.createElement('div');
            Object.assign(tabsContainer.style, {
                display: 'flex',
                borderBottom: '1px solid #333'
            });

            const tabs = ['Mines', 'Research', 'LF Buildings', 'LF Techs'];
            const contentContainer = document.createElement('div');
            Object.assign(contentContainer.style, {
                flex: '1',
                padding: '15px',
                overflowY: 'auto'
            });
            this.contentContainer = contentContainer;

            tabs.forEach((tabName, index) => {
                const tab = document.createElement('div');
                tab.innerText = tabName;
                Object.assign(tab.style, {
                    padding: '10px 20px',
                    cursor: 'pointer',
                    backgroundColor: index === 0 ? '#2d3748' : 'transparent'
                });
                tab.onclick = () => {
                    Array.from(tabsContainer.children).forEach(t => t.style.backgroundColor = 'transparent');
                    tab.style.backgroundColor = '#2d3748';
                    this.activeTabIndex = index;
                    this.renderTabContent(contentContainer, index);
                };
                tabsContainer.appendChild(tab);
            });

            modal.appendChild(tabsContainer);
            modal.appendChild(contentContainer);
            document.body.appendChild(modal);
            this.isOpen = true;
            this.activeTabIndex = 0;
            this.renderTabContent(contentContainer, 0);
        }

        closeModal() {
            const modal = document.getElementById(this.modalId);
            if (modal) modal.remove();
            this.isOpen = false;
        }

        renderTabContent(container, tabIndex) {
            container.innerHTML = '';
            switch (tabIndex) {
                case 0: this.renderMinesTab(container); break;
                case 1: this.renderResearchTab(container); break;
                case 2: this.renderLFBuildingsTab(container); break;
                case 3: this.renderLFTechsTab(container); break;
            }
        }

        renderMinesTab(container) {
            const data = this.dataFetcher.empireData;
            if (!data) {
                container.innerHTML = 'No Data Available';
                return;
            }

            // Estimate Plasma Level from first planet
            // TODO: Ensure 122 is correct ID or scrape it properly
            const firstPlanet = Object.values(data)[0];
            const plasmaLevel = firstPlanet ? (parseInt(firstPlanet['122']) || 0) : 0;

            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';

            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th style="border: 1px solid #444; padding: 5px;">Planet</th>
                    <th style="border: 1px solid #444; padding: 5px; color: #99cfff;">Metal</th>
                    <th style="border: 1px solid #444; padding: 5px; color: #a0ff99;">Crystal</th>
                    <th style="border: 1px solid #444; padding: 5px; color: #ff9999;">Deuterium</th>
                </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            Object.values(data).forEach(planet => {
                const m = parseInt(planet['1']) || 0;
                const c = parseInt(planet['2']) || 0;
                const d = parseInt(planet['3']) || 0;

                // Calc ROI
                const roiM = this.calculator.calcROI(m, 1, planet, plasmaLevel);
                const roiC = this.calculator.calcROI(c, 2, planet, plasmaLevel);
                const roiD = this.calculator.calcROI(d, 3, planet, plasmaLevel);

                const row = document.createElement('tr');
                // Display: Level (ROI Days)
                row.innerHTML = `
                    <td style="border: 1px solid #444; padding: 5px;">${planet.name} [${planet.coordinates}]</td>
                    <td style="border: 1px solid #444; padding: 5px;">
                        <div style="font-weight:bold;">${m}</div>
                        <div style="font-size: 0.9em; color: #888;">${roiM.roiDays.toFixed(1)}d</div>
                    </td>
                    <td style="border: 1px solid #444; padding: 5px;">
                        <div style="font-weight:bold;">${c}</div>
                        <div style="font-size: 0.9em; color: #888;">${roiC.roiDays.toFixed(1)}d</div>
                    </td>
                    <td style="border: 1px solid #444; padding: 5px;">
                        <div style="font-weight:bold;">${d}</div>
                        <div style="font-size: 0.9em; color: #888;">${roiD.roiDays.toFixed(1)}d</div>
                    </td>
                `;
                tbody.appendChild(row);
            });
            table.appendChild(tbody);
            container.appendChild(table);
        }

        renderResearchTab(container) {
            const data = this.dataFetcher.empireData;
            const firstPlanet = Object.values(data || {})[0];
            const plasmaLevel = firstPlanet ? (firstPlanet['122'] || 0) : 'Unknown';
            container.innerHTML = `
                <h3>Research Levels</h3>
                <div style="margin-top: 20px;">
                    <strong>Plasma Technology:</strong> 
                    <span style="font-size: 1.5em; color: #48bb78; margin-left: 10px;">${plasmaLevel}</span>
                </div>
            `;
        }

        renderLFBuildingsTab(container) {
            const data = this.dataFetcher.empireData;
            if (!data) return;
            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th style="border: 1px solid #444; padding: 5px;">Planet</th>
                        <th style="border: 1px solid #444; padding: 5px; color: #d4a373;">Magma</th>
                        <th style="border: 1px solid #444; padding: 5px; color: #d4a373;">Refinery</th>
                        <th style="border: 1px solid #444; padding: 5px; color: #d4a373;">DeutSyn</th>
                        <th style="border: 1px solid #444; padding: 5px; color: #a3b1d4;">Smelt</th>
                        <th style="border: 1px solid #444; padding: 5px; color: #e5e5e5;">PerfSyn</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.values(data).map(p => `
                        <tr>
                            <td style="border: 1px solid #444; padding: 5px;">${p.name}</td>
                            <td style="border: 1px solid #444; padding: 5px;">${p['12103'] || 0}</td>
                            <td style="border: 1px solid #444; padding: 5px;">${p['12104'] || 0}</td>
                            <td style="border: 1px solid #444; padding: 5px;">${p['12105'] || 0}</td>
                            <td style="border: 1px solid #444; padding: 5px;">${p['11103'] || 0}</td>
                            <td style="border: 1px solid #444; padding: 5px;">${p['13103'] || 0}</td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
            container.appendChild(table);
        }

        renderLFTechsTab(container) {
            const data = this.dataFetcher.empireData;
            if (!data) return;
            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';

            let header = '<tr><th style="border: 1px solid #444; padding: 5px;">Planet</th>';
            for (let i = 1; i <= 18; i++) header += `<th style="border: 1px solid #444; padding:2px; text-align:center; font-size:10px;">S${i}</th>`;
            header += '</tr>';

            const rows = Object.values(data).map(p => {
                let r = `<tr><td style="border: 1px solid #444; padding: 5px;">${p.name}</td>`;
                for (let i = 1; i <= 18; i++) {
                    const h = 11200 + i, ro = 12200 + i, m = 13200 + i, k = 14200 + i;
                    const val = p[h] || p[ro] || p[m] || p[k] || 0;
                    let color = '#fff';
                    if (p[h]) color = '#a3b1d4';
                    else if (p[ro]) color = '#d4a373';
                    else if (p[m]) color = '#e5e5e5';
                    else if (p[k]) color = '#a2845e';
                    r += `<td style="border: 1px solid #444; padding: 5px; text-align:center; color:${color};">${val}</td>`;
                }
                return r + '</tr>';
            }).join('');

            table.innerHTML = `<thead>${header}</thead><tbody>${rows}</tbody>`;
            container.appendChild(table);

            const legend = document.createElement('div');
            legend.style.marginTop = '10px';
            legend.innerHTML = 'Legend: <span style="color:#a3b1d4">Human</span>, <span style="color:#d4a373">Rocktal</span>, <span style="color:#e5e5e5">Mecha</span>, <span style="color:#a2845e">Kaelesh</span>';
            container.appendChild(legend);
        }
    }

    // --- Calculator ---
    class Calculator {
        constructor() {
            this.serverSpeed = 1; // Default, should try to scrape or user input
            this.mse = { metal: 1, crystal: 1.5, deut: 3 }; // Standard MSE, customizable later
        }

        // --- Production Formulas ---
        getMetalProd(level, plasmaLevel, geolog, items, classBonus, lfBonus) {
            // Base * Level * 1.1^Level
            // Plasma: 1% per level (0.01 * level * baseProd) or (1 + 0.01*level) * baseProd? 
            // Standard: BaseProd * (1 + Plasma + Geo + Items + Class + LF)
            const base = 30 * level * Math.pow(1.1, level);
            const plasma = level > 0 ? (plasmaLevel * 0.01) : 0; // 1% per plasma level for Metal
            return base * (1 + plasma + (lfBonus || 0)) * this.serverSpeed;
        }

        getCrystalProd(level, plasmaLevel, lfBonus) {
            const base = 20 * level * Math.pow(1.1, level);
            const plasma = level > 0 ? (plasmaLevel * 0.0066) : 0; // 0.66% per plasma level
            return base * (1 + plasma + (lfBonus || 0)) * this.serverSpeed;
        }

        getDeutProd(level, avgTemp, plasmaLevel, lfBonus) {
            // 10 * level * 1.1^level * (1.44 - 0.004 * avgTemp)
            const base = 10 * level * Math.pow(1.1, level) * (1.44 - 0.004 * avgTemp);
            // Plasma: 0.33% per level? (Actually OGame added Plasma for Deut recently? Need to verify. Assume 0 or user config). 
            // EDIT: Plasma does boost Deut now in many universes. 0.33%.
            const plasma = level > 0 ? (plasmaLevel * 0.0033) : 0;
            return base * (1 + plasma + (lfBonus || 0)) * this.serverSpeed;
        }

        // --- Cost Formulas ---
        getMetalCost(level) {
            return {
                metal: 60 * Math.pow(1.5, level - 1),
                crystal: 15 * Math.pow(1.5, level - 1)
            };
        }

        getCrystalCost(level) {
            return {
                metal: 48 * Math.pow(1.6, level - 1),
                crystal: 24 * Math.pow(1.6, level - 1)
            };
        }

        getDeutCost(level) {
            return {
                metal: 225 * Math.pow(1.5, level - 1),
                crystal: 75 * Math.pow(1.5, level - 1)
            };
        }

        getMSE(cost) {
            return (cost.metal || 0) * this.mse.metal + (cost.crystal || 0) * this.mse.crystal + (cost.deut || 0) * this.mse.deut; // Deut cost is rare for mines usually
        }

        // --- ROI Calculation ---
        calcROI(currentLevel, type, planetData, plasmaLevel, lfData) {
            // Type: 1=Metal, 2=Crystal, 3=Deut
            const nextLevel = currentLevel + 1;
            let cost, prodDiff;

            // TODO: Extract LF Bonus for this planet/resource
            // For now assuming 0 LF bonus diff to simplify
            const lfBonus = 0;

            if (type === 1) {
                cost = this.getMetalCost(nextLevel);
                const currentProd = this.getMetalProd(currentLevel, plasmaLevel, 0, 0, 0, lfBonus);
                const nextProd = this.getMetalProd(nextLevel, plasmaLevel, 0, 0, 0, lfBonus);
                prodDiff = nextProd - currentProd; // Hourly production gain
            } else if (type === 2) {
                cost = this.getCrystalCost(nextLevel);
                const currentProd = this.getCrystalProd(currentLevel, plasmaLevel, lfBonus);
                const nextProd = this.getCrystalProd(nextLevel, plasmaLevel, lfBonus);
                prodDiff = nextProd - currentProd;
            } else if (type === 3) {
                // Temp: 128 maps to temperature in Empire view? Need to check.
                // "temperature": 40 (min) or similar.
                // OGLight data key "temperature" or 128??
                // The fetched json has "temperature" key.
                let avgTemp = planetData.temperature || 20;
                // Actually map has min/max usually, take avg?
                // OGLight parsing: "temperature" === entry[0] ? ... = parseInt(...)

                cost = this.getDeutCost(nextLevel);
                const currentProd = this.getDeutProd(currentLevel, avgTemp, plasmaLevel, lfBonus);
                const nextProd = this.getDeutProd(nextLevel, avgTemp, plasmaLevel, lfBonus);
                prodDiff = nextProd - currentProd;
            }

            const totalCostMSE = this.getMSE(cost);
            const prodMSE = prodDiff * (type === 1 ? this.mse.metal : type === 2 ? this.mse.crystal : this.mse.deut);

            // ROI in Hours
            const roiHours = totalCostMSE / prodMSE;
            return {
                cost: cost,
                prodDiff: prodDiff,
                roiHours: roiHours,
                roiDays: roiHours / 24
            };
        }
    }

    // --- Main ---
    class ROIAdvisor {
        constructor() {
            this.dataFetcher = new DataFetcher();
            this.calculator = new Calculator();
            this.uiManager = new UIManager(this.dataFetcher, this.calculator);
        }

        init() {
            console.log('ROI Advisor: Initializing...');
            this.uiManager.createButton();
        }
    }

    // Singleton Start
    const app = new ROIAdvisor();
    app.init();

})();
