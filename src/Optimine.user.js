// ==UserScript==
// @name        OG_Optimine
// @namespace    https://github.com/patrik-alexander-wagner/OGprofitability
// @version      1.0.0
// @description  ROI recommendations for buildings/tech/LF
// @author       Bel'Veste
// @match        https://*.ogame.gameforge.com/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/patrik-alexander-wagner/OGprofitability/main/src/Optimine.user.js
// @downloadURL  https://raw.githubusercontent.com/patrik-alexander-wagner/OGprofitability/main/src/Optimine.user.js
// @homepageURL  https://github.com/patrik-alexander-wagner/OGprofitability
// ==/UserScript==

(function () {
    'use strict';

    // --- Constants & Config ---
    const SCRIPT_ID = 'ogame_optimine';
    const TEAMS = {
        HUMAN: 1,
        ROCKTAL: 2,
        MECHA: 3,
        KAELESH: 4
    };

    const LF_RACES = {
        1: 'Humans',
        2: 'Rock’tal',
        3: 'Mechas',
        4: 'Kaelesh'
    };

    function getPlayerClass() {
        const sprite = document.querySelector("#characterclass .sprite");
        if (!sprite) {
            const metaId = document.querySelector('meta[name="ogame-character-class"]')?.getAttribute('content');
            const mapped = { '1': 'collector', '2': 'general', '3': 'discoverer' }[metaId];
            return mapped || 'none';
        }

        if (sprite.classList.contains('miner')) return 'collector';
        if (sprite.classList.contains('warrior')) return 'general';
        if (sprite.classList.contains('discoverer') || sprite.classList.contains('explorer')) return 'discoverer';

        return 'none';
    }

    function detectActiveRaceFromBuildings(planet) {
        const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
        Object.entries(planet).forEach(([id, val]) => {
            const numericId = parseInt(id);
            const level = parseInt(val) || 0;
            if (level > 0) {
                if (numericId >= 11100 && numericId < 12000) counts[1]++;
                if (numericId >= 12100 && numericId < 13000) counts[2]++;
                if (numericId >= 13100 && numericId < 14000) counts[3]++;
                if (numericId >= 14100 && numericId < 15000) counts[4]++;
            }
        });

        let activeRaceId = 0;
        let maxCount = 0;
        Object.entries(counts).forEach(([id, count]) => {
            if (count > maxCount) {
                maxCount = count;
                activeRaceId = parseInt(id);
            }
        });
        return activeRaceId;
    }

    // LF Tech metadata: ID -> details
    const LF_TECH_DATA = {
        // Human
        11201: { name: "Intergalactic Envoys", baseCost: [5000, 2500, 500], factorCost: 1.3, bonus: { type: 'expedition', base: 1, factor: 1 } },
        11202: { name: "High-Performance Extractors", baseCost: [7000, 10000, 5000], factorCost: 1.5, bonus: { type: 'prod', base: 0.06, factor: 1 } },
        11203: { name: "Fusion Drives", baseCost: [15000, 10000, 5000], factorCost: 1.3, bonus: { type: 'speed', base: 0.5, factor: 1 } },
        11204: { name: "Stealth Field Generator", baseCost: [20000, 15000, 7500], factorCost: 1.3, bonus: { type: 'none', base: 0.1, factor: 1 } },
        11205: { name: "Orbital Den", baseCost: [25000, 20000, 10000], factorCost: 1.3, bonus: { type: 'none', base: 4, factor: 1 } },
        11206: { name: "Research AI", baseCost: [35000, 25000, 15000], factorCost: 1.5, bonus: { type: 'research', base: 0.1, factor: 1 } },


        11207: { name: "High-Performance Terraformer", baseCost: [70000, 40000, 20000], factorCost: 1.3, bonus: { type: 'none', base: 0.1, factor: 1 } },
        11208: { name: "Enhanced Production Technologies", baseCost: [80000, 50000, 20000], factorCost: 1.5, bonus: { type: 'prod', base: 0.06, factor: 1 } },
        11209: { name: "Light Fighter Mk II", baseCost: [320000, 240000, 100000], factorCost: 1.5, bonus: { type: 'none', base: 0.3, factor: 1 } },
        11210: { name: "Cruiser Mk II", baseCost: [320000, 240000, 100000], factorCost: 1.5, bonus: { type: 'none', base: 0.3, factor: 1 } },
        11211: { name: "Improved Lab Technology", baseCost: [120000, 30000, 25000], factorCost: 1.5, bonus: { type: 'research', base: 0.1, factor: 1 } },
        11212: { name: "Plasma Terraformer", baseCost: [100000, 40000, 30000], factorCost: 1.3, bonus: { type: 'none', base: 0.1, factor: 1 } },
        11213: { name: "Low-Temperature Drives", baseCost: [200000, 100000, 100000], factorCost: 1.3, bonus: { type: 'speed', base: 0.1, factor: 1 } },
        11214: { name: "Bomber Mk II", baseCost: [160000, 120000, 50000], factorCost: 1.5, bonus: { type: 'none', base: 0.3, factor: 1 } },
        11215: { name: "Destroyer Mk II", baseCost: [160000, 120000, 50000], factorCost: 1.5, bonus: { type: 'none', base: 0.3, factor: 1 } },
        11216: { name: "Battlecruiser Mk II", baseCost: [320000, 240000, 100000], factorCost: 1.5, bonus: { type: 'none', base: 0.3, factor: 1 } },
        11217: { name: "Robot Assistants", baseCost: [300000, 180000, 120000], factorCost: 1.5, bonus: { type: 'research', base: 0.2, factor: 1 } },
        11218: { name: "Supercomputer", baseCost: [500000, 300000, 200000], factorCost: 1.2, bonus: { type: 'prod', base: 0.3, factor: 1 } },
        // Rock'tal
        12201: { name: "Volcanic Batteries", baseCost: [10000, 6000, 1000], factorCost: 1.5, bonus: { type: 'energy', base: 0.25, factor: 1 } },
        12202: { name: "Acoustic Scanning", baseCost: [7500, 12500, 5000], factorCost: 1.5, bonus: { type: 'prod', base: 0.08, factor: 1 } },
        12203: { name: "High Energy Pump Systems", baseCost: [15000, 10000, 5000], factorCost: 1.5, bonus: { type: 'deut-prod', base: 0.08, factor: 1 } },
        12204: { name: "Cargo Hold Expansion (Civilian Ships)", baseCost: [20000, 15000, 7500], factorCost: 1.3, bonus: { type: 'none', base: 0.4, factor: 1 } },
        12205: { name: "Magma-Powered Production", baseCost: [25000, 20000, 10000], factorCost: 1.5, bonus: { type: 'prod', base: 0.08, factor: 1 } },
        12206: { name: "Geothermal Power Plants", baseCost: [50000, 50000, 20000], factorCost: 1.5, bonus: { type: 'none', base: 0.25, factor: 1 } },
        12207: { name: "Depth Sounding", baseCost: [70000, 40000, 20000], factorCost: 1.5, bonus: { type: 'metal-prod', base: 0.08, factor: 1 } },
        12208: { name: "Ion Crystal Enhancement (Heavy Fighter)", baseCost: [160000, 120000, 50000], factorCost: 1.5, bonus: { type: 'none', base: 0.3, factor: 1 } },
        12209: { name: "Improved Stellarator", baseCost: [75000, 55000, 25000], factorCost: 1.5, bonus: { type: 'none', base: 0.15, factor: 1 } },
        12210: { name: "Hardened Diamond Drill Heads", baseCost: [85000, 40000, 35000], factorCost: 1.5, bonus: { type: 'metal-prod', base: 0.08, factor: 1 } },
        12211: { name: "Seismic Mining Technology", baseCost: [120000, 30000, 25000], factorCost: 1.5, bonus: { type: 'crystal-prod', base: 0.08, factor: 1 } },
        12212: { name: "Magma-Powered Pump Systems", baseCost: [100000, 40000, 30000], factorCost: 1.5, bonus: { type: 'prod', base: 0.08, factor: 1 } },
        12213: { name: "Ion Crystal Modules", baseCost: [200000, 100000, 100000], factorCost: 1.2, bonus: { type: 'none', base: 0.1, factor: 1 } },
        12214: { name: "Optimised Silo Construction Method", baseCost: [220000, 110000, 110000], factorCost: 1.3, bonus: { type: 'none', base: 0.1, factor: 1 } },
        12215: { name: "Diamond Energy Transmitter", baseCost: [240000, 120000, 120000], factorCost: 1.3, bonus: { type: 'none', base: 0.1, factor: 1 } },
        12216: { name: "Obsidian Shield Reinforcement", baseCost: [250000, 250000, 250000], factorCost: 1.4, bonus: { type: 'none', base: 0.5, factor: 1 } },
        12217: { name: "Rune Shields", baseCost: [500000, 300000, 200000], factorCost: 1.5, bonus: { type: 'none', base: 0.2, factor: 1 } },
        12218: { name: "Rock’tal Collector Enhancement", baseCost: [300000, 180000, 120000], factorCost: 1.7, bonus: { type: 'collector', base: 0.2, factor: 1 } },
        // Mecha
        13201: { name: "Catalyser Technology", baseCost: [10000, 6000, 1000], factorCost: 1.5, bonus: { type: 'prod', base: 0.08, factor: 1 } },
        13202: { name: "Plasma Drive", baseCost: [7500, 12500, 5000], factorCost: 1.3, bonus: { type: 'speed', base: 0.2, factor: 1 } },
        13203: { name: "Efficiency Module", baseCost: [15000, 10000, 5000], factorCost: 1.5, bonus: { type: 'prod', base: 0.03, factor: 1 } },
        13204: { name: "Depot AI", baseCost: [20000, 15000, 7500], factorCost: 1.3, bonus: { type: 'none', base: 0.1, factor: 1 } },
        13205: { name: "General Overhaul (Light Fighter)", baseCost: [160000, 120000, 50000], factorCost: 1.5, bonus: { type: 'none', base: 0.3, factor: 1 } },
        13206: { name: "Automated Transport Lines", baseCost: [50000, 50000, 20000], factorCost: 1.5, bonus: { type: 'prod', base: 0.06, factor: 1 } },
        13207: { name: "Improved Drone AI", baseCost: [70000, 40000, 20000], factorCost: 1.3, bonus: { type: 'expedition', base: 0.1, factor: 1 } },
        13208: { name: "Experimental Recycling Technology", baseCost: [160000, 120000, 50000], factorCost: 1.5, bonus: { type: 'none', base: 1, factor: 1 } },
        13209: { name: "General Overhaul (Cruiser)", baseCost: [160000, 120000, 50000], factorCost: 1.5, bonus: { type: 'none', base: 0.3, factor: 1 } },
        13210: { name: "Slingshot Autopilot", baseCost: [85000, 40000, 35000], factorCost: 1.2, bonus: { type: 'none', base: 0.15, factor: 1 } },
        13211: { name: "High-Temperature Superconductors", baseCost: [120000, 30000, 25000], factorCost: 1.3, bonus: { type: 'research', base: 0.1, factor: 1 } },
        13212: { name: "General Overhaul (Battleship)", baseCost: [160000, 120000, 50000], factorCost: 1.5, bonus: { type: 'none', base: 0.3, factor: 1 } },
        13213: { name: "Artificial Swarm Intelligence", baseCost: [200000, 100000, 100000], factorCost: 1.5, bonus: { type: 'prod', base: 0.06, factor: 1 } },
        13214: { name: "General Overhaul (Battlecruiser)", baseCost: [160000, 120000, 50000], factorCost: 1.5, bonus: { type: 'none', base: 0.3, factor: 1 } },
        13215: { name: "General Overhaul (Bomber)", baseCost: [320000, 240000, 100000], factorCost: 1.5, bonus: { type: 'none', base: 0.3, factor: 1 } },
        13216: { name: "General Overhaul (Destroyer)", baseCost: [320000, 240000, 100000], factorCost: 1.5, bonus: { type: 'none', base: 0.3, factor: 1 } },
        13217: { name: "Experimental Weapons Technology", baseCost: [500000, 300000, 200000], factorCost: 1.5, bonus: { type: 'research', base: 0.2, factor: 1 } },
        13218: { name: "Mechan General Enhancement", baseCost: [300000, 180000, 120000], factorCost: 1.7, bonus: { type: 'general', base: 0.2, factor: 1 } },
        // Kaelesh
        14201: { name: "Heat Recovery", baseCost: [10000, 6000, 1000], factorCost: 1.5, bonus: { type: 'prod', base: 0.03, factor: 1 } },
        14202: { name: "Sulphide Process", baseCost: [7500, 12500, 5000], factorCost: 1.5, bonus: { type: 'prod', base: 0.08, factor: 1 } },
        14203: { name: "Psionic Network", baseCost: [15000, 10000, 5000], factorCost: 1.5, bonus: { type: 'expedition', base: 0.05, factor: 1 } },
        14204: { name: "Telekinetic Tractor Beam", baseCost: [20000, 15000, 7500], factorCost: 1.5, bonus: { type: 'none', base: 0.2, factor: 1 } },
        14205: { name: "Enhanced Sensor Technology", baseCost: [25000, 20000, 10000], factorCost: 1.5, bonus: { type: 'expedition', base: 0.2, factor: 1 } },
        14206: { name: "Neuromodal Compressor", baseCost: [50000, 50000, 20000], factorCost: 1.3, bonus: { type: 'none', base: 0.4, factor: 1 } },
        14207: { name: "Neuro-Interface", baseCost: [70000, 40000, 20000], factorCost: 1.5, bonus: { type: 'research', base: 0.1, factor: 1 } },
        14208: { name: "Interplanetary Analysis Network", baseCost: [80000, 50000, 20000], factorCost: 1.2, bonus: { type: 'exploration', base: 0.6, factor: 1 } },
        14209: { name: "Overclocking (Heavy Fighter)", baseCost: [320000, 240000, 100000], factorCost: 1.5, bonus: { type: 'none', base: 0.3, factor: 1 } },
        14210: { name: "Telekinetic Drive", baseCost: [85000, 40000, 35000], factorCost: 1.2, bonus: { type: 'speed', base: 0.1, factor: 1 } },
        14211: { name: "Sixth Sense", baseCost: [120000, 30000, 25000], factorCost: 1.5, bonus: { type: 'expedition', base: 0.2, factor: 1 } },
        14212: { name: "Psychoharmoniser", baseCost: [100000, 40000, 30000], factorCost: 1.5, bonus: { type: 'prod', base: 0.06, factor: 1 } },
        14213: { name: "Efficient Swarm Intelligence", baseCost: [200000, 100000, 100000], factorCost: 1.5, bonus: { type: 'prod', base: 0.1, factor: 1 } },
        14214: { name: "Overclocking (Large Cargo)", baseCost: [160000, 120000, 50000], factorCost: 1.5, bonus: { type: 'none', base: 1, factor: 1 } },
        14215: { name: "Gravitation Sensors", baseCost: [240000, 120000, 120000], factorCost: 1.5, bonus: { type: 'expedition', base: 0.1, factor: 1 } },
        14216: { name: "Overclocking (Battleship)", baseCost: [320000, 240000, 100000], factorCost: 1.5, bonus: { type: 'none', base: 0.3, factor: 1 } },
        14217: { name: "Psionic Shield Matrix", baseCost: [500000, 300000, 200000], factorCost: 1.5, bonus: { type: 'none', base: 0.2, factor: 1 } },
        14218: { name: "Kaelesh Discoverer Enhancement", baseCost: [300000, 180000, 120000], factorCost: 1.7, bonus: { type: 'discoverer', base: 0.2, factor: 1 } },
    };

    const LF_TECH_SLOTS = [1, 2, 3, 5, 6, 7, 8, 10, 11, 12];

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

    // LF Building cost data from param_config.json
    const LF_BUILDING_COSTS = {
        12106: { metal: 10000, crystal: 8000, deut: 1000, priceFactor: 1.4 },  // Magma Forge (Rock'tal)
        12109: { metal: 85000, crystal: 44000, deut: 25000, priceFactor: 1.4 },  // Crystal Refinery (Rock'tal)
        12110: { metal: 120000, crystal: 50000, deut: 20000, priceFactor: 1.4 },  // Deuterium Synthesizer (Rock'tal)
        11106: { metal: 9000, crystal: 6000, deut: 3000, priceFactor: 1.5 },  // High Energy Smelting (Human)
        11108: { metal: 50000, crystal: 25000, deut: 15000, priceFactor: 1.5 },  // Fusion-Powered Production (Human)
        13110: { metal: 100000, crystal: 40000, deut: 20000, priceFactor: 1.5 }  // High-Performance Synthesizer (Mecha)
    };

    // User-verified LF Techs organized by position (each position can have different tech per lifeform)
    // Players can choose ANY tech at each position, independent of active lifeform
    const LF_TECHS_BY_POSITION = [
        { pos: 1, name: 'T1 - Slot 1', ids: { human: 11201, rocktal: 12201, mecha: 13201, kaelesh: 14201 } },
        { pos: 2, name: 'T1 - Slot 2', ids: { human: 11202, rocktal: 12202, mecha: 13202, kaelesh: 14202 } },
        { pos: 3, name: 'T1 - Slot 3', ids: { human: 11203, rocktal: 12203, mecha: 13203, kaelesh: 14203 } },
        { pos: 5, name: 'T1 - Slot 5', ids: { human: 11205, rocktal: 12205, mecha: 13205, kaelesh: 14205 } },
        { pos: 6, name: 'T1 - Slot 6', ids: { human: 11206, rocktal: 12206, mecha: 13206, kaelesh: 14206 } },
        { pos: 7, name: 'T2 - Slot 7', ids: { human: 11207, rocktal: 12207, mecha: 13207, kaelesh: 14207 } },
        { pos: 8, name: 'T2 - Slot 8', ids: { human: 11208, rocktal: 12208, mecha: 13208, kaelesh: 14208 } },
        { pos: 10, name: 'T2 - Slot 10', ids: { human: 11210, rocktal: 12210, mecha: 13210, kaelesh: 14210 } },
        { pos: 11, name: 'T2 - Slot 11', ids: { human: 11211, rocktal: 12211, mecha: 13211, kaelesh: 14211 } },
        { pos: 12, name: 'T2 - Slot 12', ids: { human: 11212, rocktal: 12212, mecha: 13212, kaelesh: 14212 } },
        { pos: 13, name: 'T3 - Slot 13', ids: { human: 11213, rocktal: 12213, mecha: 13213, kaelesh: 14213 } }
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
                        .catch(err => console.error(`OptiMine: Error fetching type ${type}`, err))
                );

                await Promise.all(promises);
                console.log('OptiMine: Empire Data Fetched', this.empireData);
                return this.empireData;
            } catch (error) {
                console.error('OptiMine: Critical Error fetching Empire Data', error);
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

                console.log('OptiMine: LF Bonuses Fetched', this.lfBonuses);
                return this.lfBonuses;
            } catch (error) {
                console.error('OptiMine: Error fetching LF Bonuses', error);
                return null;
            }
        }

        async fetchAll() {
            console.log('OptiMine: Fetching all data...');
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
            this.modalId = 'optimine-modal';
            this.isOpen = false;
            this.contentContainer = null; // To store the content div for re-rendering
            this.activeTabIndex = 0; // To keep track of the currently active tab
        }

        createButton() {
            const menu = document.querySelector('#menuTable');
            if (!menu) return;

            // Check if button already exists
            if (document.getElementById('optimine-btn')) return;

            const buttonContainer = document.createElement('li');
            buttonContainer.id = 'optimine-btn';
            buttonContainer.className = 'menubutton_table';

            const link = document.createElement('a');
            link.className = 'menubutton';
            link.href = '#';
            link.innerHTML = '<span class="textlabel" style="color: #4a9eff;">OptiMine</span>';
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

            // Load saved position and size from localStorage
            const savedState = JSON.parse(localStorage.getItem('roiAdvisorModalState') || '{}');
            const initialLeft = savedState.left || '5%';
            const initialTop = savedState.top || '5%';
            const initialWidth = savedState.width || '90%';
            const initialHeight = savedState.height || '80%';

            const modal = document.createElement('div');
            modal.id = this.modalId;
            Object.assign(modal.style, {
                position: 'fixed',
                top: initialTop,
                left: initialLeft,
                transform: 'none',
                width: initialWidth,
                minWidth: '600px',
                maxWidth: '95%',
                height: initialHeight,
                minHeight: '400px',
                maxHeight: '95%',
                backgroundColor: '#161e2b',
                border: '2px solid #555',
                borderRadius: '10px',
                zIndex: '9999',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 0 20px rgba(0,0,0,0.8)',
                fontSize: '12px',
                resize: 'both',
                overflow: 'hidden'
            });

            // Header
            const header = document.createElement('div');
            Object.assign(header.style, {
                padding: '10px',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'move',
                userSelect: 'none'
            });

            const title = document.createElement('h3');
            const version = (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script.version : '1.0.0';
            title.innerText = `OptiMine (v${version}) by Bel Veste`;
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

            const tabs = ['OptiMine', 'Mines', 'Research', 'LF Buildings', 'LF Techs'];
            const contentContainer = document.createElement('div');
            Object.assign(contentContainer.style, {
                flex: '1',
                padding: '15px',
                overflowY: 'auto',
                overflowX: 'auto'
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

            // Dragging Logic
            let isDragging = false;
            let offset = { x: 0, y: 0 };

            const saveModalState = () => {
                const state = {
                    left: modal.style.left,
                    top: modal.style.top,
                    width: modal.style.width,
                    height: modal.style.height
                };
                localStorage.setItem('roiAdvisorModalState', JSON.stringify(state));
            };

            header.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                isDragging = true;
                const rect = modal.getBoundingClientRect();
                offset = {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };
                header.style.cursor = 'grabbing';
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                const x = e.clientX - offset.x;
                const y = e.clientY - offset.y;

                modal.style.left = `${x}px`;
                modal.style.top = `${y}px`;
                modal.style.transform = 'none';
            });

            window.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    header.style.cursor = 'move';
                    saveModalState();
                }
            });

            // Resize Persistence
            const resizeObserver = new ResizeObserver(() => {
                if (this.isOpen) {
                    saveModalState();
                }
            });
            resizeObserver.observe(modal);

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
                case 0: this.renderROIAdvisorTab(container); break;
                case 1: this.renderMinesTab(container); break;
                case 2: this.renderResearchTab(container); break;
                case 3: this.renderLFBuildingsTab(container); break;
                case 4: this.renderLFTechsTab(container); break;
            }
        }

        renderROIAdvisorTab(container) {
            const data = this.dataFetcher.empireData;
            if (!data) {
                container.innerHTML = 'No Data Available';
                return;
            }

            // MSU Ratio Configuration
            const msuRatios = this.loadMSURatios();

            const header = document.createElement('div');
            header.style.cssText = 'margin-bottom:20px; padding:15px; background:#1a1a2e; border-radius:8px;';
            header.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="margin:0 0 10px 0;">OptiMine - Top Investment Opportunities</h3>
                        <div style="font-size:11px; color:#888;">Sorted by best return on investment (ROI in days)</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:11px; color:#888; margin-bottom:5px;">MSU Conversion Ratios:</div>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <span style="color:#cd7f32;">Metal:</span>
                            <input id="msu-metal" type="number" value="${msuRatios.metal}" min="0.1" step="0.1" style="width:50px; padding:3px; text-align:center;" />
                            <span style="color:#6fb1fc;">Crystal:</span>
                            <input id="msu-crystal" type="number" value="${msuRatios.crystal}" min="0.1" step="0.1" style="width:50px; padding:3px; text-align:center;" />
                            <span style="color:#6bde6b;">Deut:</span>
                            <input id="msu-deut" type="number" value="${msuRatios.deut}" min="0.1" step="0.1" style="width:50px; padding:3px; text-align:center;" />
                            <button id="save-msu-btn" style="padding:5px 10px; background:#4a9eff; color:white; border:none; border-radius:4px; cursor:pointer;">Save</button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(header);

            // Calculate all ROI opportunities
            const opportunities = this.calculateAllROI(data, msuRatios);

            // Sort by ROI (ascending - best ROI first)
            opportunities.sort((a, b) => a.roiDays - b.roiDays);

            // Take top 100
            const topOpportunities = opportunities.slice(0, 100);

            // Display table
            const table = document.createElement('table');
            table.style.cssText = 'width:100%; border-collapse:collapse; font-size:11px;';

            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th style="border:1px solid #444; padding:8px; background:#2a3a4e;">#</th>
                    <th style="border:1px solid #444; padding:8px; background:#2a3a4e;">Planet</th>
                    <th style="border:1px solid #444; padding:8px; background:#2a3a4e;">Type</th>
                    <th style="border:1px solid #444; padding:8px; background:#2a3a4e;">Current Lvl</th>
                    <th style="border:1px solid #444; padding:8px; background:#2a3a4e;">Next Lvl</th>
                    <th style="border:1px solid #444; padding:8px; background:#2a3a4e;">Cost (MSU)</th>
                    <th style="border:1px solid #444; padding:8px; background:#2a3a4e;">Δ Hourly (MSU/h)</th>
                    <th style="border:1px solid #444; padding:8px; background:#2a3a4e;">Δ Daily (MSU/day)</th>
                    <th style="border:1px solid #444; padding:8px; background:#2a3a4e;">ROI (days)</th>
                    <th style="border:1px solid #444; padding:8px; background:#2a3a4e;">ROI (weeks)</th>
                </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            topOpportunities.forEach((opp, index) => {
                const row = document.createElement('tr');
                row.style.cssText = index % 2 === 0 ? 'background:#1a1a2e;' : '';
                row.innerHTML = `
                    <td style="border:1px solid #444; padding:8px; text-align:center; font-weight:bold;">${index + 1}</td>
                    <td style="border:1px solid #444; padding:8px;">${opp.planetName}</td>
                    <td style="border:1px solid #444; padding:8px; color:${opp.color};">${opp.type}</td>
                    <td style="border:1px solid #444; padding:8px; text-align:center;">${opp.currentLevel}</td>
                    <td style="border:1px solid #444; padding:8px; text-align:center;">${opp.nextLevel}</td>
                    <td style="border:1px solid #444; padding:8px; text-align:right;">${this.formatNumber(opp.costMSU)}</td>
                    <td style="border:1px solid #444; padding:8px; text-align:right;">${this.formatNumber(opp.prodIncreaseMSU)}</td>
                    <td style="border:1px solid #444; padding:8px; text-align:right;">${this.formatNumber(opp.prodDailyMSU)}</td>
                    <td style="border:1px solid #444; padding:8px; text-align:right; font-weight:bold; color:#4a9eff;">${opp.roiDays.toFixed(2)}</td>
                    <td style="border:1px solid #444; padding:8px; text-align:right; font-weight:bold; color:#48bb78;">${(opp.roiDays / 7).toFixed(2)}</td>
                `;
                tbody.appendChild(row);
            });
            table.appendChild(tbody);
            container.appendChild(table);

            // Save button event
            document.getElementById('save-msu-btn').addEventListener('click', () => {
                this.saveMSURatios();
                this.renderTabContent(container, 0); // Refresh the tab
            });
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

            // Calculate GLOBAL LF Tech bonuses (using interactive selection data)
            const selectionData = JSON.parse(localStorage.getItem(`${SCRIPT_ID}_lf_tech_selections`) || '{}');
            let globalMetalTechBonus = 0;
            let globalCrystalTechBonus = 0;
            let globalDeutTechBonus = 0;
            let globalCollectorTechBonus = 0;

            Object.values(data).forEach(planet => {
                if (planet.isMoon) return;
                const techBonuses = this.calculatePlanetTechBonuses(planet.id, selectionData, planet);
                globalMetalTechBonus += techBonuses.metal;
                globalCrystalTechBonus += techBonuses.crystal;
                globalDeutTechBonus += techBonuses.deut;
                globalCollectorTechBonus += techBonuses.collector;
            });

            const playerClass = getPlayerClass();
            const baseClassBonus = playerClass === 'collector' ? 25 : 0;
            const enhancedClassBonus = baseClassBonus + (playerClass === 'collector' ? globalCollectorTechBonus : 0);

            // Display GLOBAL Tech Bonuses at top (Plasma + LF Techs)
            const globalMetalBonus = plasmaMetalBonus + globalMetalTechBonus;
            const globalCrystalBonus = plasmaCrystalBonus + globalCrystalTechBonus;
            const globalDeutBonus = plasmaDeutBonus + globalDeutTechBonus;

            const bonusSummary = document.createElement('div');
            bonusSummary.style.cssText = 'padding:10px; margin-bottom:15px; background:#1a1a2e; border-radius:5px; display:flex; justify-content:space-around; align-items:center;';

            const classDisplay = playerClass === 'collector' ?
                `<div style="color:#f1c40f; font-weight:bold; font-size:11px;">Collector Class: +${enhancedClassBonus.toFixed(2)}% Bonus Applied (${baseClassBonus}% Base + ${globalCollectorTechBonus.toFixed(2)}% LF)</div>` :
                `<div style="color:#888; font-size:11px;">Player Class: ${playerClass.charAt(0).toUpperCase() + playerClass.slice(1)}</div>`;

            bonusSummary.innerHTML = `
                <div style="text-align:center;">
                    <div style="font-size:10px; color:#888; margin-bottom:5px;">Universe Speed: ${universeSpeed}x</div>
                    ${classDisplay}
                </div>
                <div style="text-align:center;">
                    <div style="font-size:12px; color:#888; margin-bottom:5px;">Global Tech Bonus (Metal)</div>
                    <div style="font-size:18px; font-weight:bold; color:#cd7f32;">${globalMetalBonus.toFixed(2)}%</div>
                    <div style="font-size:10px; color:#666;">Plasma: ${plasmaMetalBonus.toFixed(2)}% | LF Techs: ${globalMetalTechBonus.toFixed(2)}%</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:12px; color:#888; margin-bottom:5px;">Global Tech Bonus (Crystal)</div>
                    <div style="font-size:18px; font-weight:bold; color:#6fb1fc;">${globalCrystalBonus.toFixed(2)}%</div>
                    <div style="font-size:10px; color:#666;">Plasma: ${plasmaCrystalBonus.toFixed(2)}% | LF Techs: ${globalCrystalTechBonus.toFixed(2)}%</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:12px; color:#888; margin-bottom:5px;">Global Tech Bonus (Deut)</div>
                    <div style="font-size:18px; font-weight:bold; color:#6bde6b;">${globalDeutBonus.toFixed(2)}%</div>
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
                    <th style="border: 1px solid #444; padding: 5px; color: #cd7f32;">Metal Mine</th>
                    <th style="border: 1px solid #444; padding: 5px; color: #6fb1fc;">Crystal Mine</th>
                    <th style="border: 1px solid #444; padding: 5px; color: #6bde6b;">Deut Synth</th>
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

                // Total DISPLAYED bonuses = Global Tech + Buildings (planet only) + Collector Class (Enhanced)
                const totalPlanetMetalBonus = globalMetalBonus + planetBuildingBonus.metal + enhancedClassBonus;
                const totalPlanetCrystalBonus = globalCrystalBonus + planetBuildingBonus.crystal + enhancedClassBonus;
                const totalPlanetDeutBonus = globalDeutBonus + planetBuildingBonus.deut + enhancedClassBonus;

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
                        <div style="font-size:10px; color:#cd7f32;">Current: ${this.formatNumber(currentMetalProd)}/h</div>
                        <div style="font-size:9px; color:#666;">Bonus: +${totalPlanetMetalBonus.toFixed(1)}%</div>
                    </td>
                    <td style="border: 1px solid #444; padding: 5px;">
                        <div style="font-weight:bold;">Level ${c}</div>
                        <div style="font-size:10px; color:#888;">Base: ${this.formatNumber(baseCrystalProd * universeSpeed)}/h</div>
                        <div style="font-size:10px; color:#6fb1fc;">Current: ${this.formatNumber(currentCrystalProd)}/h</div>
                        <div style="font-size:9px; color:#666;">Bonus: +${totalPlanetCrystalBonus.toFixed(1)}%</div>
                    </td>
                    <td style="border: 1px solid #444; padding: 5px;">
                        <div style="font-weight:bold;">Level ${d}</div>
                        <div style="font-size:10px; color:#888;">Base: ${this.formatNumber(baseDeutProd * universeSpeed)}/h (${tempInfo})</div>
                        <div style="font-size:10px; color:#6bde6b;">Current: ${this.formatNumber(currentDeutProd)}/h</div>
                        <div style="font-size:9px; color:#666;">Bonus: +${totalPlanetDeutBonus.toFixed(1)}%</div>
                    </td>
                `;
                tbody.appendChild(row);

                // Store production values for totals calculation
                if (!this.productionTotals) {
                    this.productionTotals = { metal: 0, crystal: 0, deut: 0 };
                }
                this.productionTotals.metal += currentMetalProd;
                this.productionTotals.crystal += currentCrystalProd;
                this.productionTotals.deut += currentDeutProd;
            });

            // Add totals row
            const totalsRow = document.createElement('tr');
            totalsRow.style.cssText = 'background-color: #2a3a4e; font-weight: bold;';
            totalsRow.innerHTML = `
                <td style="border: 1px solid #444; padding: 8px;">TOTAL PRODUCTION</td>
                <td style="border: 1px solid #444; padding: 8px; color: #cd7f32;">${this.formatNumber(this.productionTotals.metal)}/h</td>
                <td style="border: 1px solid #444; padding: 8px; color: #6fb1fc;">${this.formatNumber(this.productionTotals.crystal)}/h</td>
                <td style="border: 1px solid #444; padding: 8px; color: #6bde6b;">${this.formatNumber(this.productionTotals.deut)}/h</td>
            `;
            tbody.appendChild(totalsRow);

            table.appendChild(tbody);
            container.appendChild(table);

            // Reset totals for next render
            this.productionTotals = { metal: 0, crystal: 0, deut: 0 };
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


        calculateBaseProduction(level, mineType, planet) {
            // OGame production formulas (per hour, assuming 100% power)
            // Metal: 30 * level * 1.1^level
            // Crystal: 20 * level * 1.1^level  
            // Deuterium: A × (10 × L × 1.1^L) × (1.36 - 0.004 × T_avg)
            //   where T_avg = average of min and max temperature

            if (level === 0) return 0;

            let baseProduction = 0;
            if (mineType === 1) { // Metal
                baseProduction = Math.floor(30 * level * Math.pow(1.1, level));
            } else if (mineType === 2) { // Crystal
                baseProduction = Math.floor(20 * level * Math.pow(1.1, level));
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
                baseProduction = Math.floor(base * level * Math.pow(1.1, level) * tempFactor);
            }

            // BaseProduction calculation remains raw
            return baseProduction;
        }

        formatNumber(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return Math.floor(num).toString();
        }

        loadMSURatios() {
            const stored = localStorage.getItem('roiAdvisor_msuRatios');
            if (stored) {
                try {
                    return JSON.parse(stored);
                } catch (e) {
                    console.error('Failed to load MSU ratios:', e);
                }
            }
            // Default: 3 metal = 2 crystal = 1 deut
            // So in MSU terms: metal = 1, crystal = 1.5, deut = 3
            return { metal: 1, crystal: 1.5, deut: 3 };
        }

        saveMSURatios() {
            const metal = parseFloat(document.getElementById('msu-metal').value) || 1;
            const crystal = parseFloat(document.getElementById('msu-crystal').value) || 1.5;
            const deut = parseFloat(document.getElementById('msu-deut').value) || 3;

            const ratios = { metal, crystal, deut };
            localStorage.setItem('roiAdvisor_msuRatios', JSON.stringify(ratios));
        }

        toMSU(metal, crystal, deut, ratios) {
            // Normalize ratios to treat them as equivalences
            // If user enters (3, 2, 1), it means "3 metal = 2 crystal = 1 deut"
            // So we need multipliers: metal=1, crystal=3/2=1.5, deut=3/1=3
            const normalizedRatios = this.normalizeRatios(ratios);

            // Convert resources to MSU
            return (metal * normalizedRatios.metal) + (crystal * normalizedRatios.crystal) + (deut * normalizedRatios.deut);
        }

        normalizeRatios(ratios) {
            // Normalize so that metal is the base (multiplier = 1)
            // If input is (3, 2, 1) meaning "3 metal = 2 crystal = 1 deut"
            // Then: metal_mult = 1, crystal_mult = 3/2, deut_mult = 3/1
            const metalBase = ratios.metal;
            return {
                metal: metalBase / ratios.metal,    // Always 1
                crystal: metalBase / ratios.crystal,  // e.g., 3/2 = 1.5
                deut: metalBase / ratios.deut         // e.g., 3/1 = 3
            };
        }

        calculateAllROI(data, msuRatios) {
            const opportunities = [];

            // Get universe speed
            const universeSpeed = this.getUniverseSpeed();

            // Get Global Tech Bonuses
            const firstPlanet = Object.values(data)[0];
            const plasmaLevel = firstPlanet ? (parseInt(firstPlanet['122']) || 0) : 0;
            const plasmaMetalBonus = plasmaLevel * 1;
            const plasmaCrystalBonus = plasmaLevel * 0.66;
            const plasmaDeutBonus = plasmaLevel * 0.33;

            const savedTechData = this.loadLFTechData();
            let globalMetalTechBonus = 0;
            let globalCrystalTechBonus = 0;
            let globalDeutTechBonus = 0;
            let globalCollectorTechBonus = 0;
            let globalGeneralTechBonus = 0;
            let globalDiscovererTechBonus = 0;

            let empireBaseMetal = 0;
            let empireBaseCrystal = 0;
            let empireBaseDeut = 0;

            Object.values(data).forEach(planet => {
                if (planet.isMoon) return;
                const techBonuses = this.calculatePlanetTechBonuses(planet.id, savedTechData, planet);
                globalMetalTechBonus += techBonuses.metal;
                globalCrystalTechBonus += techBonuses.crystal;
                globalDeutTechBonus += techBonuses.deut;
                globalCollectorTechBonus += techBonuses.collector;
                globalGeneralTechBonus += techBonuses.general;
                globalDiscovererTechBonus += techBonuses.discoverer;

                // Aggregate empire base production for global tech ROI
                const coords = planet.coordinates ? planet.coordinates.replace('[', '').replace(']', '') : '';
                const position = coords ? parseInt(coords.split(':')[2]) || 0 : 0;
                const positionBonus = this.getPositionBonus(position);

                const mLevel = parseInt(planet['1']) || 0;
                const cLevel = parseInt(planet['2']) || 0;
                const dLevel = parseInt(planet['3']) || 0;

                const rawM = this.calculateBaseProduction(mLevel, 1, planet);
                const rawC = this.calculateBaseProduction(cLevel, 2, planet);
                const rawD = this.calculateBaseProduction(dLevel, 3, planet);

                empireBaseMetal += rawM * (1 + positionBonus.metal / 100) * universeSpeed;
                empireBaseCrystal += rawC * (1 + positionBonus.crystal / 100) * universeSpeed;
                empireBaseDeut += rawD * universeSpeed;
            });

            // Process each planet
            Object.values(data).forEach(planet => {
                if (planet.isMoon) return;

                const coords = planet.coordinates ? planet.coordinates.replace('[', '').replace(']', '') : '';
                const position = coords ? parseInt(coords.split(':')[2]) || 0 : 0;

                // LF TECH ROI (Calculated per planet slot selection)
                const planetId = planet.id;
                const planetTechs = savedTechData[planetId] || {};
                const positions = [1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13];

                positions.forEach(pos => {
                    const posData = planetTechs[`pos${pos}`];
                    if (posData && posData.techId) {
                        const techId = posData.techId;
                        const tech = LF_TECH_DATA[techId];
                        if (tech && tech.bonus) {
                            const currentLevel = parseInt(planet[techId]) || 0;
                            const nextLevel = currentLevel + 1;

                            // Cost for next level
                            const techCost = this.getLFTechCost(techId, nextLevel);
                            const costMSU = this.toMSU(techCost.metal, techCost.crystal, techCost.deut, msuRatios);

                            // Production increase (Global impact)
                            // Bonus increase per level: tech.bonus.base * tech.bonus.factor
                            const bonusIncrease = tech.bonus.base * tech.bonus.factor;
                            let prodIncreaseMSU = 0;

                            const normalizedRatios = this.normalizeRatios(msuRatios);

                            if (tech.bonus.type === 'prod' || tech.bonus.type === 'collector') {
                                // Impact on all resources
                                const incM = empireBaseMetal * (bonusIncrease / 100);
                                const incC = empireBaseCrystal * (bonusIncrease / 100);
                                const incD = empireBaseDeut * (bonusIncrease / 100);
                                prodIncreaseMSU = (incM * normalizedRatios.metal) + (incC * normalizedRatios.crystal) + (incD * normalizedRatios.deut);
                            } else if (tech.bonus.type === 'metal-prod') {
                                const incM = empireBaseMetal * (bonusIncrease / 100);
                                prodIncreaseMSU = incM * normalizedRatios.metal;
                            } else if (tech.bonus.type === 'crystal-prod') {
                                const incC = empireBaseCrystal * (bonusIncrease / 100);
                                prodIncreaseMSU = incC * normalizedRatios.crystal;
                            } else if (tech.bonus.type === 'deut-prod') {
                                const incD = empireBaseDeut * (bonusIncrease / 100);
                                prodIncreaseMSU = incD * normalizedRatios.deut;
                            }

                            if (prodIncreaseMSU > 0) {
                                const prodDailyMSU = prodIncreaseMSU * 24;
                                const roiDays = costMSU / prodDailyMSU;

                                opportunities.push({
                                    planetName: planet.name,
                                    type: `Tech: ${tech.name}`,
                                    color: this.getTechColor(techId, pos),
                                    currentLevel,
                                    nextLevel,
                                    costMSU,
                                    prodIncreaseMSU,
                                    prodDailyMSU,
                                    roiDays
                                });
                            }
                        }
                    }
                });

                // Get planet bonuses
                const planetBuildingBonus = this.calculateLFBuildingBonuses(planet);
                const positionBonus = this.getPositionBonus(position);

                // Total bonuses per resource (Plasma + LF Techs[global] + LF Buildings[planet-specific] + Collector Class)
                const playerClass = getPlayerClass();
                const baseClassBonus = playerClass === 'collector' ? 25 : 0;
                const enhancedClassBonus = baseClassBonus + (playerClass === 'collector' ? globalCollectorTechBonus : 0);

                const totalMetalBonus = plasmaMetalBonus + globalMetalTechBonus + planetBuildingBonus.metal + enhancedClassBonus;
                const totalCrystalBonus = plasmaCrystalBonus + globalCrystalTechBonus + planetBuildingBonus.crystal + enhancedClassBonus;
                const totalDeutBonus = plasmaDeutBonus + globalDeutTechBonus + planetBuildingBonus.deut + enhancedClassBonus;

                // METAL MINE ROI
                const metalLevel = parseInt(planet['1']) || 0;
                const metalCost = this.getMineCost(1, metalLevel + 1);
                const metalProdCurrent = this.calculateMineProduction(1, metalLevel, planet, position, totalMetalBonus, universeSpeed);
                const metalProdNext = this.calculateMineProduction(1, metalLevel + 1, planet, position, totalMetalBonus, universeSpeed);
                const metalProdIncrease = metalProdNext - metalProdCurrent;

                if (metalProdIncrease > 0) {
                    const costMSU = this.toMSU(metalCost.metal, metalCost.crystal, 0, msuRatios);
                    const normalizedRatios = this.normalizeRatios(msuRatios);
                    const prodHourlyMSU = metalProdIncrease * normalizedRatios.metal;
                    const prodDailyMSU = prodHourlyMSU * 24;
                    const roiDays = costMSU / prodDailyMSU;

                    opportunities.push({
                        planetName: planet.name,
                        type: 'Metal Mine',
                        color: '#cd7f32',
                        currentLevel: metalLevel,
                        nextLevel: metalLevel + 1,
                        costMSU,
                        prodIncreaseMSU: prodHourlyMSU,
                        prodDailyMSU: prodDailyMSU,
                        roiDays
                    });
                }

                // CRYSTAL MINE ROI
                const crystalLevel = parseInt(planet['2']) || 0;
                const crystalCost = this.getMineCost(2, crystalLevel + 1);
                const crystalProdCurrent = this.calculateMineProduction(2, crystalLevel, planet, position, totalCrystalBonus, universeSpeed);
                const crystalProdNext = this.calculateMineProduction(2, crystalLevel + 1, planet, position, totalCrystalBonus, universeSpeed);
                const crystalProdIncrease = crystalProdNext - crystalProdCurrent;

                if (crystalProdIncrease > 0) {
                    const costMSU = this.toMSU(crystalCost.metal, crystalCost.crystal, 0, msuRatios);
                    const normalizedRatios = this.normalizeRatios(msuRatios);
                    const prodHourlyMSU = crystalProdIncrease * normalizedRatios.crystal;
                    const prodDailyMSU = prodHourlyMSU * 24;
                    const roiDays = costMSU / prodDailyMSU;

                    opportunities.push({
                        planetName: planet.name,
                        type: 'Crystal Mine',
                        color: '#6fb1fc',
                        currentLevel: crystalLevel,
                        nextLevel: crystalLevel + 1,
                        costMSU,
                        prodIncreaseMSU: prodHourlyMSU,
                        prodDailyMSU: prodDailyMSU,
                        roiDays
                    });
                }

                // DEUTERIUM SYNTHESIZER ROI
                const deutLevel = parseInt(planet['3']) || 0;
                const deutCost = this.getMineCost(3, deutLevel + 1);
                const deutProdCurrent = this.calculateMineProduction(3, deutLevel, planet, position, totalDeutBonus, universeSpeed);
                const deutProdNext = this.calculateMineProduction(3, deutLevel + 1, planet, position, totalDeutBonus, universeSpeed);
                const deutProdIncrease = deutProdNext - deutProdCurrent;

                if (deutProdIncrease > 0) {
                    const costMSU = this.toMSU(deutCost.metal, deutCost.crystal, 0, msuRatios);
                    const normalizedRatios = this.normalizeRatios(msuRatios);
                    const prodHourlyMSU = deutProdIncrease * normalizedRatios.deut;
                    const prodDailyMSU = prodHourlyMSU * 24;
                    const roiDays = costMSU / prodDailyMSU;

                    opportunities.push({
                        planetName: planet.name,
                        type: 'Deut Synth',
                        color: '#6bde6b',
                        currentLevel: deutLevel,
                        nextLevel: deutLevel + 1,
                        costMSU,
                        prodIncreaseMSU: prodHourlyMSU,
                        prodDailyMSU: prodDailyMSU,
                        roiDays
                    });
                }

                // LF BUILDING ROI CALCULATIONS
                // BASE PRODUCTION FOR LF CALCULATIONS (includes position bonus and universe speed)
                const rawMetalProd = this.calculateBaseProduction(metalLevel, 1, planet);
                const rawCrystalProd = this.calculateBaseProduction(crystalLevel, 2, planet);
                const rawDeutProd = this.calculateBaseProduction(parseInt(planet['3']) || 0, 3, planet);

                const baseMetalScaled = rawMetalProd * (1 + positionBonus.metal / 100) * universeSpeed;
                const baseCrystalScaled = rawCrystalProd * (1 + positionBonus.crystal / 100) * universeSpeed;
                const baseDeutScaled = rawDeutProd * universeSpeed;

                // Process LF Buildings
                const raceId = detectActiveRaceFromBuildings(planet);
                const raceToKey = { 1: 'human', 2: 'rocktal', 3: 'mecha', 4: 'kaelesh' };
                const activeKey = raceToKey[raceId] || '';

                if (activeKey && LF_BUILDINGS[activeKey]) {
                    LF_BUILDINGS[activeKey].forEach(building => {
                        const buildingLevel = parseInt(planet[building.id]) || 0;
                        const nextLevel = buildingLevel + 1;

                        // Get cost for next level
                        const buildingCost = this.getLFBuildingCost(building.id, nextLevel);
                        const costMSU = this.toMSU(buildingCost.metal, buildingCost.crystal, buildingCost.deut, msuRatios);

                        // Calculate production increase from building bonus
                        // Building bonuses are cumulative and apply to base production
                        const bonusIncreasePerLevel = building.baseValue * building.increaseFactor;
                        let prodIncreaseHourly = 0;
                        let colorCode = '';
                        let mineType = 0;

                        if (building.bonusType === 'metal' && metalLevel > 0) {
                            mineType = 1;
                            colorCode = '#cd7f32';
                            prodIncreaseHourly = baseMetalScaled * (bonusIncreasePerLevel / 100);
                        } else if (building.bonusType === 'crystal' && crystalLevel > 0) {
                            mineType = 2;
                            colorCode = '#6fb1fc';
                            prodIncreaseHourly = baseCrystalScaled * (bonusIncreasePerLevel / 100);
                        } else if (building.bonusType === 'deut' && (parseInt(planet['3']) || 0) > 0) {
                            mineType = 3;
                            colorCode = '#6bde6b';
                            prodIncreaseHourly = baseDeutScaled * (bonusIncreasePerLevel / 100);
                        }

                        if (prodIncreaseHourly > 0) {
                            const normalizedRatios = this.normalizeRatios(msuRatios);
                            let prodHourlyMSU = 0;

                            if (mineType === 1) prodHourlyMSU = prodIncreaseHourly * normalizedRatios.metal;
                            else if (mineType === 2) prodHourlyMSU = prodIncreaseHourly * normalizedRatios.crystal;
                            else if (mineType === 3) prodHourlyMSU = prodIncreaseHourly * normalizedRatios.deut;

                            const prodDailyMSU = prodHourlyMSU * 24;
                            const roiDays = costMSU / prodDailyMSU;

                            opportunities.push({
                                planetName: planet.name,
                                type: building.name,
                                color: colorCode,
                                currentLevel: buildingLevel,
                                nextLevel: nextLevel,
                                costMSU,
                                prodIncreaseMSU: prodHourlyMSU,
                                prodDailyMSU: prodDailyMSU,
                                roiDays
                            });
                        }
                    });
                }
            });

            return opportunities;
        }

        getMineCost(mineType, level) {
            // Cost formulas for mines
            if (mineType === 1) { // Metal
                return {
                    metal: Math.floor(60 * Math.pow(1.5, level - 1)),
                    crystal: Math.floor(15 * Math.pow(1.5, level - 1))
                };
            } else if (mineType === 2) { // Crystal
                return {
                    metal: Math.floor(48 * Math.pow(1.6, level - 1)),
                    crystal: Math.floor(24 * Math.pow(1.6, level - 1))
                };
            } else if (mineType === 3) { // Deuterium
                return {
                    metal: Math.floor(225 * Math.pow(1.5, level - 1)),
                    crystal: Math.floor(75 * Math.pow(1.5, level - 1))
                };
            }
            return { metal: 0, crystal: 0 };
        }

        calculateMineProduction(mineType, level, planet, position, totalBonus, universeSpeed) {
            // Calculate production with all bonuses applied
            if (level === 0) return 0;

            const positionBonus = this.getPositionBonus(position);
            const baseProduction = this.calculateBaseProduction(level, mineType, planet);

            // Apply position bonus to base (built-in, not displayed separately)
            let prodWithPosition = baseProduction;
            if (mineType === 1) {
                prodWithPosition = baseProduction * (1 + positionBonus.metal / 100);
            } else if (mineType === 2) {
                prodWithPosition = baseProduction * (1 + positionBonus.crystal / 100);
            }
            // Deut position bonus is via temperature, already in baseProduction

            // Apply displayed bonuses (Plasma + LF Tech + LF Buildings)
            const prodWithBonuses = prodWithPosition * (1 + totalBonus / 100);

            // Apply universe speed
            return prodWithBonuses * universeSpeed;
        }

        getLFBuildingCost(buildingId, level) {
            // Cost formula: cost = baseCost * priceFactor^(L-1) * L
            const costData = LF_BUILDING_COSTS[buildingId];
            if (!costData) return { metal: 0, crystal: 0, deut: 0 };

            const multiplier = Math.pow(costData.priceFactor, level - 1) * level;

            return {
                metal: Math.floor(costData.metal * multiplier),
                crystal: Math.floor(costData.crystal * multiplier),
                deut: Math.floor(costData.deut * multiplier)
            };
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
                        <span style="color: #cd7f32;">Metal Bonus:</span> <strong>${mBonus}%</strong>
                    </div>
                    <div style="padding: 10px; background: #2d3748; border-radius: 5px;">
                        <span style="color: #6fb1fc;">Crystal Bonus:</span> <strong>${cBonus}%</strong>
                    </div>
                    <div style="padding: 10px; background: #2d3748; border-radius: 5px;">
                        <span style="color: #6bde6b;">Deut Bonus:</span> <strong>${dBonus}%</strong>
                    </div>
                </div>
            `;
        }

        loadLFTechData() {
            try {
                return JSON.parse(localStorage.getItem(`${SCRIPT_ID}_lf_tech_selections`) || '{}');
            } catch (e) {
                return {};
            }
        }

        saveLFTechData(data) {
            localStorage.setItem(`${SCRIPT_ID}_lf_tech_selections`, JSON.stringify(data));
        }

        getTechsForPosition(pos, planet) {
            const posEntry = LF_TECHS_BY_POSITION.find(p => p.pos === pos);
            if (!posEntry) return [];
            const raceMap = { human: 'Human', rocktal: 'Rock’tal', mecha: 'Mecha', kaelesh: 'Kaelesh' };
            const options = [];

            // Define production-related types
            const prodTypes = ['prod', 'metal-prod', 'crystal-prod', 'deut-prod', 'collector', 'general', 'discoverer'];

            Object.entries(posEntry.ids).forEach(([race, id]) => {
                const tech = LF_TECH_DATA[id];
                // Only include if tech exists and provides a production-relevant bonus
                if (tech && tech.bonus && prodTypes.includes(tech.bonus.type)) {
                    const level = parseInt(planet[id]) || 0;
                    options.push({
                        id,
                        shortName: `${raceMap[race]}: ${tech.name || id} (Lv ${level})`,
                        level
                    });
                }
            });
            return options;
        }

        getTechColor(techId, pos) {
            if (!techId) return '#1a1a2e'; // Default for no tech
            const tech = LF_TECH_DATA[techId];
            if (!tech) return '#1a1a2e';

            const raceId = Math.floor(techId / 1000);
            const raceColors = {
                11: '#27ae60', // Human (Green)
                12: '#e67e22', // Rock'tal (Orange)
                13: '#2980b9', // Mecha (Blue)
                14: '#8e44ad'  // Kaelesh (Purple)
            };
            return raceColors[raceId] || '#1a1a2e';
        }

        getTechInfo(techId) {
            if (!techId) return null;
            const tech = LF_TECH_DATA[techId];
            if (!tech) return null;

            const raceId = Math.floor(techId / 1000);
            const raceMap = { 11: 'Human', 12: 'Rock’tal', 13: 'Mecha', 14: 'Kaelesh' };

            return {
                id: techId,
                name: tech.name,
                race: raceMap[raceId] || 'Unknown'
            };
        }

        calculateLFBuildingBonuses(planet) {
            const bonuses = { metal: 0, crystal: 0, deut: 0 };
            const raceId = detectActiveRaceFromBuildings(planet);
            const raceToKey = { 1: 'human', 2: 'rocktal', 3: 'mecha', 4: 'kaelesh' };
            const activeKey = raceToKey[raceId] || '';

            if (activeKey && LF_BUILDINGS[activeKey]) {
                LF_BUILDINGS[activeKey].forEach(building => {
                    const level = parseInt(planet[building.id]) || 0;
                    if (level > 0) {
                        const bonus = level * building.baseValue * building.increaseFactor;
                        if (building.bonusType === 'metal') bonuses.metal += bonus;
                        else if (building.bonusType === 'crystal') bonuses.crystal += bonus;
                        else if (building.bonusType === 'deut') bonuses.deut += bonus;
                    }
                });
            }
            return bonuses;
        }

        calculatePlanetTechBonuses(planetId, selectionData, planet) {
            const bonuses = { metal: 0, crystal: 0, deut: 0, collector: 0, general: 0, discoverer: 0 };
            const slots = [1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13];
            const planetData = selectionData[planetId] || {};

            slots.forEach(pos => {
                const cellData = planetData[`pos${pos}`] || {};
                const techId = cellData.techId;
                // Automatically read level from game data (planet object)
                const level = techId ? (parseInt(planet[techId]) || 0) : 0;

                if (techId && level > 0) {
                    const b = this.calculateTechBonus(techId, level);
                    bonuses.metal += b.metal;
                    bonuses.crystal += b.crystal;
                    bonuses.deut += b.deut;
                    bonuses.collector += b.collector;
                    bonuses.general += b.general;
                    bonuses.discoverer += b.discoverer;
                }
            });
            return bonuses;
        }

        calculateTechBonus(techId, level) {
            const tech = LF_TECH_DATA[techId];
            if (!tech || !tech.bonus || level <= 0) return { metal: 0, crystal: 0, deut: 0, collector: 0, general: 0, discoverer: 0 };

            const perc = tech.bonus.base * tech.bonus.factor * level;

            const result = { metal: 0, crystal: 0, deut: 0, collector: 0, general: 0, discoverer: 0 };
            if (tech.bonus.type === 'prod') {
                result.metal = result.crystal = result.deut = perc;
            } else if (tech.bonus.type === 'metal-prod') {
                result.metal = perc;
            } else if (tech.bonus.type === 'crystal-prod') {
                result.crystal = perc;
            } else if (tech.bonus.type === 'deut-prod') {
                result.deut = perc;
            } else if (tech.bonus.type === 'collector') {
                result.collector = perc;
            } else if (tech.bonus.type === 'general') {
                result.general = perc;
            } else if (tech.bonus.type === 'discoverer') {
                result.discoverer = perc;
            }
            return result;
        }

        getLFTechCost(techId, level) {
            const tech = LF_TECH_DATA[techId];
            if (!tech) return { metal: 0, crystal: 0, deut: 0 };

            // OGame LF Tech cost formula: baseCost * level * factorCost^(level-1)
            const multiplier = level * Math.pow(tech.factorCost, level - 1);

            return {
                metal: Math.floor(tech.baseCost[0] * multiplier),
                crystal: Math.floor(tech.baseCost[1] * multiplier),
                deut: Math.floor(tech.baseCost[2] * multiplier)
            };
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
                    <th style="border: 1px solid #444; padding: 5px; color: #cd7f32;">Metal Bonus</th>
                    <th style="border: 1px solid #444; padding: 5px; color: #6fb1fc;">Crystal Bonus</th>
                    <th style="border: 1px solid #444; padding: 5px; color: #6bde6b;">Deut Bonus</th>
                </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            Object.values(data).forEach(planet => {
                if (planet.isMoon) return;

                const raceId = detectActiveRaceFromBuildings(planet);
                const activeLFName = LF_RACES[raceId] || 'None';
                const raceToKey = { 1: 'human', 2: 'rocktal', 3: 'mecha', 4: 'kaelesh' };
                const activeKey = raceToKey[raceId] || '';

                let buildingsList = '';
                if (activeKey && LF_BUILDINGS[activeKey]) {
                    LF_BUILDINGS[activeKey].forEach(building => {
                        const level = parseInt(planet[building.id]) || 0;
                        if (level > 0) buildingsList += `<div>${building.name}: ${level}</div>`;
                    });
                }

                const b = this.calculateLFBuildingBonuses(planet);

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="border: 1px solid #444; padding: 5px;">${planet.name || 'Unknown'}</td>
                    <td style="border: 1px solid #444; padding: 5px; font-weight:bold;">${activeLFName}</td>
                    <td style="border: 1px solid #444; padding: 5px; font-size: 0.9em; vertical-align: top;">
                        ${buildingsList || '<span style="color:#666">-</span>'}
                    </td>
                    <td style="border: 1px solid #444; padding: 5px;">${b.metal.toFixed(2)}%</td>
                    <td style="border: 1px solid #444; padding: 5px;">${b.crystal.toFixed(2)}%</td>
                    <td style="border: 1px solid #444; padding: 5px;">${b.deut.toFixed(2)}%</td>
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
            table.style.cssText = 'width:100%; border-collapse:collapse; font-size:12px; min-height: 600px;';

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
                    const cellData = planetData[`pos${pos}`] || { techId: null };
                    const techs = this.getTechsForPosition(pos, planet);
                    const techColor = this.getTechColor(cellData.techId, pos); // Pass position for color
                    const techInfo = this.getTechInfo(cellData.techId, pos); // Pass position for accurate lookup
                    const actualLevel = cellData.techId ? (parseInt(planet[cellData.techId]) || 0) : 0;

                    tbody += `<td style="border:1px solid #444; padding:8px; text-align:center; min-width:120px;">`;

                    // Tech race and name display
                    if (cellData.techId && techInfo) {
                        tbody += `<div style="margin:0 auto 8px; padding:6px; border-radius:6px; background:${techColor}; box-shadow:0 2px 4px rgba(0,0,0,0.3);">`;
                        tbody += `<div style="font-size:9px; font-weight:bold; color:#fff; text-transform:uppercase; margin-bottom:2px;">${techInfo.race}</div>`;
                        tbody += `<div style="font-size:10px; color:#fff;">${techInfo.name}</div>`;
                        tbody += `<div style="font-size:11px; font-weight:bold; color:#fff; margin-top:4px; padding-top:4px; border-top:1px solid rgba(255,255,255,0.2);">Lv ${actualLevel}</div>`;
                        tbody += `</div>`;
                    } else {
                        // Empty placeholder
                        tbody += `<div style="height:55px; margin:0 auto 8px; border:2px dashed #444; border-radius:6px; background:#1a1a2e; display:flex; align-items:center; justify-content:center; color:#666; font-size:9px;">No Tech</div>`;
                    }

                    // Dropdown for tech selection
                    tbody += `<select data-planet="${planetId}" data-pos="${pos}" class="lf-tech-select" style="width:95%; font-size:11px; margin-bottom:5px; padding:4px;">`;
                    tbody += `<option value="">-</option>`;
                    techs.forEach(tech => {
                        const selected = cellData.techId == tech.id ? 'selected' : '';
                        tbody += `<option value="${tech.id}" ${selected}>${tech.shortName}</option>`;
                    });
                    tbody += `</select>`;

                    tbody += `</td>`;

                    // Calculate bonuses
                    if (cellData.techId && actualLevel > 0) {
                        const bonus = this.calculateTechBonus(cellData.techId, actualLevel);
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

            // Grand Total Bonus Summary Row
            tbody += `<tr style="background:#2a3a4e; font-weight:bold; border-top:2px solid #555;">`;
            tbody += `<td style="border:1px solid #444; padding:10px; text-align:right;" colspan="${positions.length + 1}">GLOBAL TOTAL BONUSES:</td>`;
            tbody += `<td style="border:1px solid #444; padding:10px; text-align:center; color:#2ecc71;">+${grandTotalMetal.toFixed(2)}%</td>`;
            tbody += `<td style="border:1px solid #444; padding:10px; text-align:center; color:#4a9eff;">+${grandTotalCrystal.toFixed(2)}%</td>`;
            tbody += `<td style="border:1px solid #444; padding:10px; text-align:center; color:#f1c40f;">+${grandTotalDeut.toFixed(2)}%</td>`;
            tbody += `</tr>`;

            tbody += '</tbody>';
            table.innerHTML = thead + tbody;
            container.appendChild(table);

            // Add Event Listeners
            container.querySelectorAll('.lf-tech-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    const planetId = e.target.dataset.planet;
                    const pos = e.target.dataset.pos;
                    const techId = e.target.value;

                    const selections = this.loadLFTechData();
                    if (!selections[planetId]) selections[planetId] = {};
                    selections[planetId][`pos${pos}`] = { techId: techId }; // Level is read from API
                    this.saveLFTechData(selections);

                    // Re-render tab
                    container.innerHTML = '';
                    this.renderLFTechsTab(container);
                });
            });

            // Save button status logic
            const saveBtn = document.getElementById('lftech-save-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    const status = document.getElementById('lftech-save-status');
                    if (status) {
                        status.textContent = 'Saved!';
                        setTimeout(() => status.textContent = '', 2000);
                    }
                });
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
        getMetalProd(level, plasmaLevel, geolog, items, lfBonus) {
            let base = 30 * level * Math.pow(1.1, level);
            const classBonus = getPlayerClass() === 'collector' ? 0.25 : 0;
            const plasma = level > 0 ? (plasmaLevel * 0.01) : 0;
            return base * (1 + plasma + classBonus + (lfBonus || 0)) * this.serverSpeed;
        }

        getCrystalProd(level, plasmaLevel, lfBonus) {
            let base = 20 * level * Math.pow(1.1, level);
            const classBonus = getPlayerClass() === 'collector' ? 0.25 : 0;
            const plasma = level > 0 ? (plasmaLevel * 0.0066) : 0;
            return base * (1 + plasma + classBonus + (lfBonus || 0)) * this.serverSpeed;
        }

        getDeutProd(level, avgTemp, plasmaLevel, lfBonus) {
            // 10 * level * 1.1^level * (1.36 - 0.004 * avgTemp)
            let base = 10 * level * Math.pow(1.1, level) * (1.36 - 0.004 * avgTemp);
            const classBonus = getPlayerClass() === 'collector' ? 0.25 : 0;
            const plasma = level > 0 ? (plasmaLevel * 0.0033) : 0;
            return base * (1 + plasma + classBonus + (lfBonus || 0)) * this.serverSpeed;
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
                const currentProd = this.getMetalProd(currentLevel, plasmaLevel, 0, 0, lfBonus);
                const nextProd = this.getMetalProd(nextLevel, plasmaLevel, 0, 0, lfBonus);
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
            console.log('OptiMine: Initializing...');
            this.uiManager.createButton();
        }
    }

    // Start when menu is ready
    function start() {
        const menu = document.querySelector('#menuTable');
        if (menu) {
            const app = new ROIAdvisor();
            app.init();
        } else {
            setTimeout(start, 500);
        }
    }

    start();
})();
