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

    const TECH_NAMES = {
        // Humans
        11201: "Envoys", 11202: "Extractors", 11203: "Fusion", 11204: "Stealth", 11205: "Orbital", 11206: "AI",
        11207: "H.Terra", 11208: "Enh.Prod", 11209: "LF MkII", 11210: "Cruiser MkII", 11211: "Imp.Lab", 11212: "Plasma T.",
        11213: "Low-Temp", 11214: "Bomb MkII", 11215: "Dest MkII", 11216: "BC MkII", 11217: "Robot", 11218: "Supercomp",
        // Rocktal
        12201: "Volcanic", 12202: "Depth Sd", 12203: "Acoustical", 12204: "HE Pump", 12205: "Cargo Exp", 12206: "Magma P.",
        12207: "Geo.PP", 12208: "Depth MkII", 12209: "Ion Cryst", 12210: "Diamond Tr", 12211: "Obsidian", 12212: "Rune Shld",
        12213: "Rock Coll", 12214: "Ion Armor", 12215: "Dia Focus", 12216: "Obs Over", 12217: "Rune Over", 12218: "Rock Over",
        // Mecha
        13201: "Catalyser", 13202: "Plasma Dr", 13203: "High Eff", 13204: "Dep.Uran", 13205: "Logic", 13206: "Auto Line",
        13207: "Sensors", 13208: "PLC Net", 13209: "Nano Rep", 13210: "Auto Rep", 13211: "Psionic", 13212: "Telekin",
        13213: "Sensing", 13214: "Graviton", 13215: "Psionic C", 13216: "Tele Dr", 13217: "6th Sense", 13218: "Psychohist",
        // Kaelesh
        14201: "Heat Rec", 14202: "Sulphide", 14203: "Psionic", 14204: "Teletrac", 14205: "Enh Sens", 14206: "Neuro",
        14207: "High Sens", 14208: "PLC Net", 14209: "Nano Rep", 14210: "Auto Rep", 14211: "Psi Net", 14212: "Tele Beam",
        14213: "Sensing", 14214: "Graviton", 14215: "Psi Comp", 14216: "Tele Dr", 14217: "6th Sense", 14218: "Psycho"
    };

    // User-verified LF Buildings with bonus mappings (from param_config.json)
    const LF_BUILDINGS = {
        rocktal: [
            { id: 12106, name: 'Magma Forge', bonusType: 'metal', baseValue: 2, increaseFactor: 1 },
            { id: 12109, name: 'Crystal Refinery', bonusType: 'crystal', baseValue: 2, increaseFactor: 1 },
            { id: 12110, name: 'Deuterium Synth', bonusType: 'deut', baseValue: 2, increaseFactor: 1 }
        ],
        human: [
            { id: 11106, name: 'High Energy Smelting', bonusType: 'metal', baseValue: 1.5, increaseFactor: 1 },
            { id: 11108, name: 'Fusion-Powered Production', bonusType: 'crystal', baseValue: 1.5, increaseFactor: 1 }
        ],
        mecha: [
            { id: 13110, name: 'High-Performance Synthesizer', bonusType: 'deut', baseValue: 2, increaseFactor: 1 }
        ]
    };

    // User-verified LF Techs organized by position (each position can have different tech per lifeform)
    // Players can choose ANY tech at each position, independent of active lifeform
    const LF_TECHS_BY_POSITION = [
        { pos: 1, name: 'Catalyzer', ids: { mecha: 13201 } },
        { pos: 2, name: 'Extract/Sulf/Acoustic', ids: { human: 12212, kaelesh: 14202, rocktal: 12202 } },
        { pos: 3, name: 'HE Pump', ids: { rocktal: 12203 } },
        { pos: 5, name: 'Magma Prod', ids: { rocktal: 12205 } },
        { pos: 6, name: 'Auto Trans', ids: { mecha: 13206 } },
        { pos: 7, name: 'Depth Snd', ids: { rocktal: 12207 } },
        { pos: 8, name: 'Enh Prod', ids: { human: 11208 } },
        { pos: 10, name: 'Dia Drill', ids: { rocktal: 12210 } },
        { pos: 11, name: 'Seismic', ids: { rocktal: 12211 } },
        { pos: 12, name: 'M.Pump/Psycho', ids: { rocktal: 12212, kaelesh: 14212 } },
        { pos: 13, name: 'AI Swarm', ids: { mecha: 13213 } }
    ];

    // --- Data Fetcher ---
    class DataFetcher {
        constructor() {
            this.empireData = null;
            this.lfBonuses = {};
        }

        async fetchEmpireData() {
            try {
                this.empireData = {};
                const types = [0, 1];

                const promises = types.map(type =>
                    fetch(`/game/index.php?page=ajax&component=empire&ajax=1&planetType=${type}&asJson=1`, {
                        headers: { "X-Requested-With": "XMLHttpRequest" }
                    })
                        .then(res => res.json())
                        .then(json => {
                            if (json.mergedArray) {
                                const parsed = JSON.parse(json.mergedArray);

                                if (parsed && parsed.planets) {
                                    parsed.planets.forEach(p => {
                                        if (p && p.id) {
                                            p.isMoon = (type === 1);
                                            this.empireData[p.id] = p;
                                        }
                                    });
                                }
                            }
                        })
                        .catch(err => console.error(`ROI Advisor: Error fetching type ${type}`, err))
                );

                await Promise.all(promises);
                console.log('ROI Advisor: Empire Data Fetched', this.empireData);
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

            // Get Plasma Level and calculate resource-specific bonuses
            const firstPlanet = Object.values(data)[0];
            const plasmaLevel = firstPlanet ? (parseInt(firstPlanet['122']) || 0) : 0;

            // Plasma bonuses are DIFFERENT per resource
            const plasmaMetalBonus = plasmaLevel * 1;      // 1% per level for metal
            const plasmaCrystalBonus = plasmaLevel * 0.66;  // 0.66% per level for crystal
            const plasmaDeutBonus = plasmaLevel * 0.33;     // 0.33% per level for deut

            // Get universe speed from meta tag
            const universeSpeed = this.getUniverseSpeed();

            // Calculate GLOBAL LF Tech bonuses (sum across ALL planets - techs apply account-wide)
            const savedTechData = this.loadLFTechData();
            let globalMetalTechBonus = 0;
            let globalCrystalTechBonus = 0;
            let globalDeutTechBonus = 0;

            Object.values(data).forEach(planet => {
                if (planet.isMoon) return;
                const techBonuses = this.calculatePlanetTechBonuses(planet.id, savedTechData);
                globalMetalTechBonus += techBonuses.metal;
                globalCrystalTechBonus += techBonuses.crystal;
                globalDeutTechBonus += techBonuses.deut;
            });

            // Display GLOBAL Tech Bonuses at top (Plasma + LF Techs)
            const globalMetalBonus = plasmaMetalBonus + globalMetalTechBonus;
            const globalCrystalBonus = plasmaCrystalBonus + globalCrystalTechBonus;
            const globalDeutBonus = plasmaDeutBonus + globalDeutTechBonus;

            const bonusSummary = document.createElement('div');
            bonusSummary.style.cssText = 'padding:10px; margin-bottom:15px; background:#1a1a2e; border-radius:5px; display:flex; justify-content:space-around;';
            bonusSummary.innerHTML = `
                <div style="text-align:center;">
                    <div style="font-size:10px; color:#888; margin-bottom:5px;">Universe Speed: ${universeSpeed}x</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:12px; color:#888; margin-bottom:5px;">Global Tech Bonus (Metal)</div>
                    <div style="font-size:18px; font-weight:bold; color:#99cfff;">${globalMetalBonus.toFixed(2)}%</div>
                    <div style="font-size:10px; color:#666;">Plasma: ${plasmaMetalBonus.toFixed(2)}% | LF Techs: ${globalMetalTechBonus.toFixed(2)}%</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:12px; color:#888; margin-bottom:5px;">Global Tech Bonus (Crystal)</div>
                    <div style="font-size:18px; font-weight:bold; color:#a0ff99;">${globalCrystalBonus.toFixed(2)}%</div>
                    <div style="font-size:10px; color:#666;">Plasma: ${plasmaCrystalBonus.toFixed(2)}% | LF Techs: ${globalCrystalTechBonus.toFixed(2)}%</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:12px; color:#888; margin-bottom:5px;">Global Tech Bonus (Deut)</div>
                    <div style="font-size:18px; font-weight:bold; color:#ff9999;">${globalDeutBonus.toFixed(2)}%</div>
                    <div style="font-size:10px; color:#666;">Plasma: ${plasmaDeutBonus.toFixed(2)}% | LF Techs: ${globalDeutTechBonus.toFixed(2)}%</div>
                </div>
            `;
            container.appendChild(bonusSummary);

            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.style.fontSize = '11px';

            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th style="border: 1px solid #444; padding: 5px;">Planet</th>
                    <th style="border: 1px solid #444; padding: 5px; color: #99cfff;">Metal Mine</th>
                    <th style="border: 1px solid #444; padding: 5px; color: #a0ff99;">Crystal Mine</th>
                    <th style="border: 1px solid #444; padding: 5px; color: #ff9999;">Deut Synth</th>
                </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            Object.values(data).forEach(planet => {
                if (planet.isMoon) return;

                const m = parseInt(planet['1']) || 0;
                const c = parseInt(planet['2']) || 0;
                const d = parseInt(planet['3']) || 0;
                const coords = planet.coordinates ? planet.coordinates.replace('[', '').replace(']', '') : '';

                // Extract planet position from coordinates (e.g., "1:234:8" -> position 8)
                const position = coords ? parseInt(coords.split(':')[2]) || 0 : 0;

                // Get planet-specific building bonuses
                const planetBuildingBonus = this.calculateLFBuildingBonuses(planet);

                // Get position bonuses - these are now part of BASE, not bonuses
                const positionBonus = this.getPositionBonus(position);

                // Total DISPLAYED bonuses = Global Tech + Buildings (planet only)
                // Position bonuses are NOT shown, they're built into base
                const totalPlanetMetalBonus = globalMetalBonus + planetBuildingBonus.metal;
                const totalPlanetCrystalBonus = globalCrystalBonus + planetBuildingBonus.crystal;
                const totalPlanetDeutBonus = globalDeutBonus + planetBuildingBonus.deut;

                // Base production formulas (per hour) - BEFORE universe speed
                // Temperature and position effects are BUILT IN to base
                const rawMetalProd = this.calculateBaseProduction(m, 1, planet);
                const rawCrystalProd = this.calculateBaseProduction(c, 2, planet);
                const rawDeutProd = this.calculateBaseProduction(d, 3, planet);

                // Apply position bonuses to base (not shown as bonus)
                const baseMetalProd = rawMetalProd * (1 + positionBonus.metal / 100);
                const baseCrystalProd = rawCrystalProd * (1 + positionBonus.crystal / 100);
                const baseDeutProd = rawDeutProd; // Temperature already in rawDeutProd

                // Apply DISPLAYED bonuses (Plasma + LF Tech + LF Buildings)
                const metalProdWithBonuses = baseMetalProd * (1 + totalPlanetMetalBonus / 100);
                const crystalProdWithBonuses = baseCrystalProd * (1 + totalPlanetCrystalBonus / 100);
                const deutProdWithBonuses = baseDeutProd * (1 + totalPlanetDeutBonus / 100);

                // Apply universe speed multiplier
                const currentMetalProd = metalProdWithBonuses * universeSpeed;
                const currentCrystalProd = crystalProdWithBonuses * universeSpeed;
                const currentDeutProd = deutProdWithBonuses * universeSpeed;

                // Get temperature info for display
                const tempInfo = this.getPlanetTempInfo(planet);

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="border: 1px solid #444; padding: 5px;">${planet.name} [${coords}]</td>
                    <td style="border: 1px solid #444; padding: 5px;">
                        <div style="font-weight:bold;">Level ${m}</div>
                        <div style="font-size:10px; color:#888;">Base: ${this.formatNumber(baseMetalProd * universeSpeed)}/h</div>
                        <div style="font-size:10px; color:#99cfff;">Current: ${this.formatNumber(currentMetalProd)}/h</div>
                        <div style="font-size:9px; color:#666;">Bonus: +${totalPlanetMetalBonus.toFixed(1)}%</div>
                    </td>
                    <td style="border: 1px solid #444; padding: 5px;">
                        <div style="font-weight:bold;">Level ${c}</div>
                        <div style="font-size:10px; color:#888;">Base: ${this.formatNumber(baseCrystalProd * universeSpeed)}/h</div>
                        <div style="font-size:10px; color:#a0ff99;">Current: ${this.formatNumber(currentCrystalProd)}/h</div>
                        <div style="font-size:9px; color:#666;">Bonus: +${totalPlanetCrystalBonus.toFixed(1)}%</div>
                    </td>
                    <td style="border: 1px solid #444; padding: 5px;">
                        <div style="font-weight:bold;">Level ${d}</div>
                        <div style="font-size:10px; color:#888;">Base: ${this.formatNumber(baseDeutProd * universeSpeed)}/h (${tempInfo})</div>
                        <div style="font-size:10px; color:#ff9999;">Current: ${this.formatNumber(currentDeutProd)}/h</div>
                        <div style="font-size:9px; color:#666;">Bonus: +${totalPlanetDeutBonus.toFixed(1)}%</div>
                    </td>
                `;
                tbody.appendChild(row);
            });
            table.appendChild(tbody);
            container.appendChild(table);
        }

        getUniverseSpeed() {
            // Try to read universe speed from OGame meta tag
            const metaTag = document.querySelector('meta[name="ogame-universe-speed"]');
            if (metaTag) {
                const speed = parseInt(metaTag.getAttribute('content'));
                return speed || 1;
            }
            // Fallback: try to get from game config
            if (window.ogame && window.ogame.serverData && window.ogame.serverData.speed) {
                return window.ogame.serverData.speed;
            }
            return 1; // Default to 1x if not found
        }

        getPlanetTemp(planet) {
            // Try multiple temperature property names and formats
            if (planet.temperatureMax !== undefined) {
                return parseInt(planet.temperatureMax);
            } else if (planet.temperature !== undefined) {
                // temperature might be stored as a string like "10°C to 50°C" or just a number
                if (typeof planet.temperature === 'string') {
                    // Extract max temperature from string like "10°C to 50°C"
                    const match = planet.temperature.match(/to\s+(\d+)/);
                    if (match) {
                        return parseInt(match[1]);
                    } else {
                        const tempMatch = planet.temperature.match(/(\d+)/);
                        if (tempMatch) return parseInt(tempMatch[0]);
                    }
                } else {
                    return parseInt(planet.temperature);
                }
            } else if (planet.fieldMax !== undefined) {
                // Fallback estimation
                return 50;
            }
            return 50; // default
        }

        getPlanetTempInfo(planet) {
            // Get temperature info for display
            if (planet.temperature !== undefined && typeof planet.temperature === 'string') {
                // Extract both temperatures from string like "10°C to 50°C"
                const matches = planet.temperature.match(/(-?\d+).*?(-?\d+)/);
                if (matches && matches.length >= 3) {
                    const minTemp = parseInt(matches[1]);
                    const maxTemp = parseInt(matches[2]);
                    const avgTemp = Math.round((minTemp + maxTemp) / 2);
                    return `Avg: ${avgTemp}°C`;
                }
            } else if (planet.temperatureMin !== undefined && planet.temperatureMax !== undefined) {
                const minTemp = parseInt(planet.temperatureMin);
                const maxTemp = parseInt(planet.temperatureMax);
                const avgTemp = Math.round((minTemp + maxTemp) / 2);
                return `Avg: ${avgTemp}°C`;
            } else if (planet.temperatureMax !== undefined) {
                return `${planet.temperatureMax}°C`;
            }
            return 'Temp: ?';
        }

        getPositionBonus(position) {
            // Position-based bonuses
            const bonuses = { metal: 0, crystal: 0, deut: 0 };

            // Crystal bonuses
            if (position === 1) bonuses.crystal = 40;
            else if (position === 2) bonuses.crystal = 30;
            else if (position === 3) bonuses.crystal = 20;

            // Metal bonuses
            if (position === 6 || position === 10) bonuses.metal = 17;
            else if (position === 7 || position === 9) bonuses.metal = 23;
            else if (position === 8) bonuses.metal = 35;

            return bonuses;
        }

        calculateLFBuildingBonuses(planet) {
            let mB = 0, cB = 0, dB = 0;

            // Detect Active Lifeform
            const h1 = parseInt(planet['11101']) || 0;
            const r1 = parseInt(planet['12101']) || 0;
            const m1 = parseInt(planet['13101']) || 0;
            const k1 = parseInt(planet['14101']) || 0;

            let activeKey = '';
            let maxTier1 = Math.max(h1, r1, m1, k1);
            if (maxTier1 > 0) {
                if (h1 === maxTier1) activeKey = 'human';
                else if (r1 === maxTier1) activeKey = 'rocktal';
                else if (m1 === maxTier1) activeKey = 'mecha';
                else if (k1 === maxTier1) activeKey = 'kaelesh';
            }

            if (activeKey && LF_BUILDINGS[activeKey]) {
                LF_BUILDINGS[activeKey].forEach(building => {
                    const level = parseInt(planet[building.id]) || 0;
                    if (level > 0) {
                        const bonus = level * building.baseValue * building.increaseFactor;
                        if (building.bonusType === 'metal') mB += bonus;
                        else if (building.bonusType === 'crystal') cB += bonus;
                        else if (building.bonusType === 'deut') dB += bonus;
                    }
                });
            }

            return { metal: mB, crystal: cB, deut: dB };
        }

        calculatePlanetTechBonuses(planetId, savedTechData) {
            let mB = 0, cB = 0, dB = 0;

            const planetData = savedTechData[planetId] || {};
            const positions = [1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13];

            positions.forEach(pos => {
                const cellData = planetData[`pos${pos}`];
                if (cellData && cellData.techId && cellData.level > 0) {
                    const bonus = this.calculateTechBonus(cellData.techId, cellData.level);
                    mB += bonus.metal || 0;
                    cB += bonus.crystal || 0;
                    dB += bonus.deut || 0;
                }
            });

            return { metal: mB, crystal: cB, deut: dB };
        }

        calculateBaseProduction(level, mineType, planet) {
            // OGame production formulas (per hour, assuming 100% power)
            // Metal: 30 * level * 1.1^level
            // Crystal: 20 * level * 1.1^level  
            // Deuterium: A × (10 × L × 1.1^L) × (1.36 - 0.004 × T_avg)
            //   where T_avg = average of min and max temperature

            if (level === 0) return 0;

            if (mineType === 1) { // Metal
                return Math.floor(30 * level * Math.pow(1.1, level));
            } else if (mineType === 2) { // Crystal
                return Math.floor(20 * level * Math.pow(1.1, level));
            } else if (mineType === 3) { // Deuterium
                // Get average temperature (between min and max)
                let avgTemp = 50; // default

                if (planet.temperature !== undefined) {
                    if (typeof planet.temperature === 'string') {
                        // Extract both temperatures from string like "10°C to 50°C"
                        const matches = planet.temperature.match(/(-?\d+).*?(-?\d+)/);
                        if (matches && matches.length >= 3) {
                            const minTemp = parseInt(matches[1]);
                            const maxTemp = parseInt(matches[2]);
                            avgTemp = (minTemp + maxTemp) / 2;
                        }
                    } else {
                        avgTemp = parseInt(planet.temperature);
                    }
                } else if (planet.temperatureMin !== undefined && planet.temperatureMax !== undefined) {
                    avgTemp = (parseInt(planet.temperatureMin) + parseInt(planet.temperatureMax)) / 2;
                } else if (planet.temperatureMax !== undefined) {
                    // Estimate: assume min is max - 40
                    const maxTemp = parseInt(planet.temperatureMax);
                    avgTemp = maxTemp - 20; // rough average
                }

                // Corrected formula: A × (10 × L × 1.1^L) × (1.36 - 0.004 × T_avg)
                // Note: A (universe speed) is applied later, not here
                const tempFactor = 1.36 - (0.004 * avgTemp);
                const base = 10;
                return Math.floor(base * level * Math.pow(1.1, level) * tempFactor);
            }
            return 0;
        }

        formatNumber(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return Math.floor(num).toString();
        }

        renderResearchTab(container) {
            const data = this.dataFetcher.empireData;
            const firstPlanet = Object.values(data || {})[0];
            const plasmaLevel = firstPlanet ? (parseInt(firstPlanet['122']) || 0) : 0;

            const mBonus = (plasmaLevel * 1).toFixed(0);
            const cBonus = (plasmaLevel * 0.66).toFixed(2);
            const dBonus = (plasmaLevel * 0.33).toFixed(2);

            container.innerHTML = `
                <h3>Research Levels</h3>
                <div style="margin-top: 20px;">
                    <strong>Plasma Technology:</strong> 
                    <span style="font-size: 1.5em; color: #48bb78; margin-left: 10px;">${plasmaLevel}</span>
                </div>
                <div style="margin-top: 15px; display: flex; gap: 20px;">
                    <div style="padding: 10px; background: #2d3748; border-radius: 5px;">
                        <span style="color: #99cfff;">Metal Bonus:</span> <strong>${mBonus}%</strong>
                    </div>
                    <div style="padding: 10px; background: #2d3748; border-radius: 5px;">
                        <span style="color: #a0ff99;">Crystal Bonus:</span> <strong>${cBonus}%</strong>
                    </div>
                    <div style="padding: 10px; background: #2d3748; border-radius: 5px;">
                        <span style="color: #ff9999;">Deut Bonus:</span> <strong>${dBonus}%</strong>
                    </div>
                </div>
            `;
        }

        renderLFBuildingsTab(container) {
            const data = this.dataFetcher.empireData;
            if (!data) {
                container.innerHTML = 'No Data Available';
                return;
            }

            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';

            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th style="border: 1px solid #444; padding: 5px;">Planet</th>
                    <th style="border: 1px solid #444; padding: 5px;">Lifeform</th>
                    <th style="border: 1px solid #444; padding: 5px;">Buildings</th>
                    <th style="border: 1px solid #444; padding: 5px; color: #99cfff;">Metal Bonus</th>
                    <th style="border: 1px solid #444; padding: 5px; color: #a0ff99;">Crystal Bonus</th>
                    <th style="border: 1px solid #444; padding: 5px; color: #ff9999;">Deut Bonus</th>
                </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            Object.values(data).forEach(planet => {
                if (planet.isMoon) return;

                // Detect Active Lifeform based on Tier 1 Building (11101, 12101, 13101, 14101)
                const h1 = parseInt(planet['11101']) || 0;
                const r1 = parseInt(planet['12101']) || 0;
                const m1 = parseInt(planet['13101']) || 0;
                const k1 = parseInt(planet['14101']) || 0;

                let activeLifeform = 'None';
                let activeKey = '';

                // Determine active lifeform by highest tier 1 building
                let maxTier1 = Math.max(h1, r1, m1, k1);
                if (maxTier1 > 0) {
                    if (h1 === maxTier1) { activeLifeform = 'Human'; activeKey = 'human'; }
                    else if (r1 === maxTier1) { activeLifeform = 'Rocktal'; activeKey = 'rocktal'; }
                    else if (m1 === maxTier1) { activeLifeform = 'Mecha'; activeKey = 'mecha'; }
                    else if (k1 === maxTier1) { activeLifeform = 'Kaelesh'; activeKey = 'kaelesh'; }
                }

                let buildingsList = '';
                let mB = 0, cB = 0, dB = 0;

                // Calculate bonuses for each building
                if (activeKey && LF_BUILDINGS[activeKey]) {
                    LF_BUILDINGS[activeKey].forEach(building => {
                        const level = parseInt(planet[building.id]) || 0;
                        if (level > 0) {
                            buildingsList += `<div>${building.name}: ${level}</div>`;

                            // Calculate bonus: level * baseValue * increaseFactor
                            // Formula: bonus = level * baseValue * increaseFactor
                            const bonus = level * building.baseValue * building.increaseFactor;

                            // Add to appropriate bonus total
                            if (building.bonusType === 'metal') mB += bonus;
                            else if (building.bonusType === 'crystal') cB += bonus;
                            else if (building.bonusType === 'deut') dB += bonus;
                        }
                    });
                }

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="border: 1px solid #444; padding: 5px;">${planet.name || 'Unknown'}</td>
                    <td style="border: 1px solid #444; padding: 5px; font-weight:bold;">${activeLifeform}</td>
                    <td style="border: 1px solid #444; padding: 5px; font-size: 0.9em; vertical-align: top;">
                        ${buildingsList || '<span style="color:#666">-</span>'}
                    </td>
                    <td style="border: 1px solid #444; padding: 5px;">${mB}%</td>
                    <td style="border: 1px solid #444; padding: 5px;">${cB}%</td>
                    <td style="border: 1px solid #444; padding: 5px;">${dB}%</td>
                `;
                tbody.appendChild(row);
            });
            table.appendChild(tbody);
            container.appendChild(table);
        }

        renderLFTechsTab(container) {
            const data = this.dataFetcher.empireData;
            if (!data) return;

            // Header with Save button
            const header = document.createElement('div');
            header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;';
            header.innerHTML = `
                <div>
                    <strong>LF Technologies (Manual Editor)</strong>
                    <span id="lftech-save-status" style="margin-left:15px; font-size:11px; color:#888;"></span>
                </div>
                <button id="lftech-save-btn" style="padding:5px 15px; background:#4a9eff; color:white; border:none; border-radius:4px; cursor:pointer;">
                    Save
                </button>
            `;
            container.appendChild(header);

            // Load saved data
            const savedData = this.loadLFTechData();

            // Build editable table
            const table = document.createElement('table');
            table.id = 'lftech-table';
            table.style.cssText = 'width:100%; border-collapse:collapse; font-size:11px;';

            // Table header
            const positions = [1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13];
            let thead = '<thead><tr><th style="border:1px solid #444; padding:5px;">Planet</th>';
            positions.forEach(pos => {
                thead += `<th style="border:1px solid #444; padding:4px; text-align:center;">P${pos}</th>`;
            });
            thead += '<th style="border:1px solid #444; padding:5px; background:#2a2a3e;">Metal %</th>';
            thead += '<th style="border:1px solid #444; padding:5px; background:#2a2a3e;">Crystal %</th>';
            thead += '<th style="border:1px solid #444; padding:5px; background:#2a2a3e;">Deut %</th>';
            thead += '</tr></thead>';

            // Table body - one row per planet
            let tbody = '<tbody>';
            let grandTotalMetal = 0, grandTotalCrystal = 0, grandTotalDeut = 0;

            Object.values(data).forEach(planet => {
                if (planet.isMoon) return;

                const planetId = planet.id;
                const planetData = savedData[planetId] || {};

                tbody += `<tr data-planet-id="${planetId}">`;
                tbody += `<td style="border:1px solid #444; padding:5px; font-weight:bold;">${planet.name}</td>`;

                let planetMetal = 0, planetCrystal = 0, planetDeut = 0;

                positions.forEach(pos => {
                    const cellData = planetData[`pos${pos}`] || { techId: null, level: 0 };
                    const techs = this.getTechsForPosition(pos);

                    tbody += `<td style="border:1px solid #444; padding:3px; text-align:center;">`;

                    // Dropdown for tech selection
                    tbody += `<select data-planet="${planetId}" data-pos="${pos}" style="width:90%; font-size:10px; margin-bottom:2px;">`;
                    tbody += `<option value="">-</option>`;
                    techs.forEach(tech => {
                        const selected = cellData.techId == tech.id ? 'selected' : '';
                        tbody += `<option value="${tech.id}" ${selected}>${tech.shortName}</option>`;
                    });
                    tbody += `</select><br/>`;

                    // Level input
                    tbody += `Lv<input type="number" min="0" max="20" value="${cellData.level || 0}" 
                              data-planet="${planetId}" data-pos="${pos}" 
                              style="width:40px; font-size:10px; text-align:center;" />`;

                    tbody += `</td>`;

                    // Calculate bonuses
                    if (cellData.techId && cellData.level > 0) {
                        const bonus = this.calculateTechBonus(cellData.techId, cellData.level);
                        planetMetal += bonus.metal || 0;
                        planetCrystal += bonus.crystal || 0;
                        planetDeut += bonus.deut || 0;
                    }
                });

                // Bonus columns
                tbody += `<td style="border:1px solid #444; padding:5px; text-align:center; background-color:#1d1d2e;" class="bonus-metal">${planetMetal.toFixed(2)}</td>`;
                tbody += `<td style="border:1px solid #444; padding:5px; text-align:center; background-color:#1d1d2e;" class="bonus-crystal">${planetCrystal.toFixed(2)}</td>`;
                tbody += `<td style="border:1px solid #444; padding:5px; text-align:center; background-color:#1d1d2e;" class="bonus-deut">${planetDeut.toFixed(2)}</td>`;
                tbody += `</tr>`;

                grandTotalMetal += planetMetal;
                grandTotalCrystal += planetCrystal;
                grandTotalDeut += planetDeut;
            });

            // Grand Total Row
            tbody += `<tr style="background:#2a3a4e; font-weight:bold;">`;
            tbody += `<td style="border:1px solid #444; padding:5px;" colspan="${positions.length + 1}">GRAND TOTAL</td>`;
            tbody += `<td id="grand-total-metal" style="border:1px solid #444; padding:5px; text-align:center;">${grandTotalMetal.toFixed(2)}</td>`;
            tbody += `<td id="grand-total-crystal" style="border:1px solid #444; padding:5px; text-align:center;">${grandTotalCrystal.toFixed(2)}</td>`;
            tbody += `<td id="grand-total-deut" style="border:1px solid #444; padding:5px; text-align:center;">${grandTotalDeut.toFixed(2)}</td>`;
            tbody += `</tr>`;
            tbody += '</tbody>';

            table.innerHTML = thead + tbody;
            container.appendChild(table);

            // Add event listeners for real-time bonus updates
            this.attachLFTechEventListeners();

            // Save button handler
            document.getElementById('lftech-save-btn').addEventListener('click', () => {
                this.saveLFTechData();
            });
        }

        getTechsForPosition(pos) {
            const techMap = {
                1: [{ id: 13201, shortName: 'Catalyzer' }],
                2: [
                    { id: 12212, shortName: 'HP Extract' },
                    { id: 14202, shortName: 'Sulfide' },
                    { id: 12202, shortName: 'Acoustic' }
                ],
                3: [{ id: 12203, shortName: 'HE Pump' }],
                5: [{ id: 12205, shortName: 'Magma Prod' }],
                6: [{ id: 13206, shortName: 'Auto Trans' }],
                7: [{ id: 12207, shortName: 'Depth Snd' }],
                8: [{ id: 11208, shortName: 'Enh Prod' }],
                10: [{ id: 12210, shortName: 'Diamond' }],
                11: [{ id: 12211, shortName: 'Seismic' }],
                12: [
                    { id: 12212, shortName: 'Magma Pump' },
                    { id: 14212, shortName: 'Psycho' }
                ],
                13: [{ id: 13213, shortName: 'AI Swarm' }]
            };
            return techMap[pos] || [];
        }

        calculateTechBonus(techId, level) {
            // Bonus mapping based on param_config.json (bonus1BaseValue * level)
            const techBonuses = {
                12212: { metal: 0.06, crystal: 0.06, deut: 0.06 },  // High-Performance Extractors
                14202: { deut: 0.08 },   // Sulfide Process 
                12202: { crystal: 0.08 },  // Acoustic Scanning
                12203: { deut: 0.08 },   // High Energy Pump
                12205: { metal: 0.08, crystal: 0.08, deut: 0.08 },  // Magma-Powered Production
                13201: { deut: 0.08 },  // Catalyzer Technology
                13206: { metal: 0.08, crystal: 0.08, deut: 0.08 },// Automated Transport
                11208: { metal: 0.06, crystal: 0.06, deut: 0.06 },  // Enhanced Production
                14212: { metal: 0.06, crystal: 0.06, deut: 0.06 },// Psychoharmoniser
                12207: { metal: 0.08 },  // Depth Sounding
                12210: { metal: 0.08 },  // Diamond Drill Heads
                12211: { crystal: 0.08 },  // Seismic Mining
                13213: { metal: 0.06, crystal: 0.06, deut: 0.06 } // AI Swarm
            };

            const bonus = techBonuses[techId] || {};
            return {
                metal: (bonus.metal || 0) * level,
                crystal: (bonus.crystal || 0) * level,
                deut: (bonus.deut || 0) * level
            };
        }

        attachLFTechEventListeners() {
            const table = document.getElementById('lftech-table');
            if (!table) return;

            table.addEventListener('change', (e) => {
                if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') {
                    this.recalculateLFTechBonuses();
                }
            });
        }

        recalculateLFTechBonuses() {
            const table = document.getElementById('lftech-table');
            if (!table) return;

            let grandMetal = 0, grandCrystal = 0, grandDeut = 0;

            table.querySelectorAll('tbody tr[data-planet-id]').forEach(row => {
                let planetMetal = 0, planetCrystal = 0, planetDeut = 0;

                row.querySelectorAll('select').forEach(select => {
                    const pos = select.getAttribute('data-pos');
                    const techId = parseInt(select.value) || null;
                    const levelInput = row.querySelector(`input[data-pos="${pos}"]`);
                    const level = parseInt(levelInput?.value) || 0;

                    if (techId && level > 0) {
                        const bonus = this.calculateTechBonus(techId, level);
                        planetMetal += bonus.metal || 0;
                        planetCrystal += bonus.crystal || 0;
                        planetDeut += bonus.deut || 0;
                    }
                });

                row.querySelector('.bonus-metal').textContent = planetMetal.toFixed(2);
                row.querySelector('.bonus-crystal').textContent = planetCrystal.toFixed(2);
                row.querySelector('.bonus-deut').textContent = planetDeut.toFixed(2);

                grandMetal += planetMetal;
                grandCrystal += planetCrystal;
                grandDeut += planetDeut;
            });

            document.getElementById('grand-total-metal').textContent = grandMetal.toFixed(2);
            document.getElementById('grand-total-crystal').textContent = grandCrystal.toFixed(2);
            document.getElementById('grand-total-deut').textContent = grandDeut.toFixed(2);
        }

        loadLFTechData() {
            const storageKey = 'roiAdvisor_lfTechs';
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                try {
                    const data = JSON.parse(stored);
                    const statusEl = document.getElementById('lftech-save-status');
                    if (statusEl && data.__timestamp) {
                        statusEl.textContent = `Last saved: ${new Date(data.__timestamp).toLocaleString()}`;
                    }
                    return data;
                } catch (e) {
                    console.error('Failed to load LF tech data:', e);
                }
            }
            return {};
        }

        saveLFTechData() {
            const table = document.getElementById('lftech-table');
            if (!table) return;

            const data = { __timestamp: Date.now() };

            table.querySelectorAll('tbody tr[data-planet-id]').forEach(row => {
                const planetId = row.getAttribute('data-planet-id');
                data[planetId] = {};

                row.querySelectorAll('select').forEach(select => {
                    const pos = select.getAttribute('data-pos');
                    const techId = parseInt(select.value) || null;
                    const levelInput = row.querySelector(`input[data-pos="${pos}"]`);
                    const level = parseInt(levelInput?.value) || 0;

                    data[planetId][`pos${pos}`] = { techId, level };
                });
            });

            localStorage.setItem('roiAdvisor_lfTechs', JSON.stringify(data));

            const statusEl = document.getElementById('lftech-save-status');
            if (statusEl) {
                statusEl.textContent = `Last saved: ${new Date().toLocaleString()}`;
                statusEl.style.color = '#4a9eff';
                setTimeout(() => { statusEl.style.color = '#888'; }, 2000);
            }
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
