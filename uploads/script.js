document.addEventListener('DOMContentLoaded', () => {
        const financingCalculator = document.getElementById('financing-calculator');
        const calculateButton = document.getElementById('calculate');
        const resultsDiv = document.getElementById('results');
        const totalBudgetDisplay = document.getElementById('totalBudgetDisplay');
        const securedFinancingDisplay = document.getElementById('securedFinancingDisplay');
        const croatiaSpendDisplay = document.getElementById('croatiaSpendDisplay');
        
        const switchSpan = document.getElementById('minorityorservice');
        switchSpan.addEventListener('click', toggleProductionType);
      
        function updateSliderDisplays() {
          const totalBudget = parseInt(financingCalculator.totalBudget.value, 10) || 500000;
          const securedFinancing = financingCalculator.securedFinancing.value || '50';
          const croatiaSpend = financingCalculator.croatiaSpend.value || '50';
        
          const securedFinancingAmount = (securedFinancing / 100) * totalBudget;
          const croatiaSpendAmount = (croatiaSpend / 100) * totalBudget;
        
          totalBudgetDisplay.textContent = formatCurrency(totalBudget) + " €";
          securedFinancingDisplay.textContent = `${securedFinancing}% / ${formatCurrency(securedFinancingAmount)} €`;
          croatiaSpendDisplay.textContent = `${croatiaSpend}% / ${formatCurrency(croatiaSpendAmount)} €`;
        
          const blaglupost = document.querySelector('input[name="productionType"][value="service"]');
          if (blaglupost.checked == false) {
            if((parseInt(financingCalculator.securedFinancing.value, 10) >= 85) || (parseInt(financingCalculator.securedFinancing.value, 10) < 50)){
              toggleProductionType();
            }
          }
        }
        document.querySelectorAll(".slider-button").forEach(function (button) {
          button.addEventListener("click", function (event) {
            event.preventDefault();
            const target = event.target;
            const targetSliderId = target.getAttribute("data-target");
            const action = target.getAttribute("data-action");
            const slider = document.getElementById(targetSliderId);
        
            if (action === "increase") {
              slider.value = parseInt(slider.value, 10) + parseInt(slider.step, 10);
            } else if (action === "decrease") {
              slider.value = parseInt(slider.value, 10) - parseInt(slider.step, 10);
            }
        
            updateSliderDisplays();
            updateResults();
          });
        });
        
        // Add event listeners to the sliders to update the value displays when changed
        financingCalculator.totalBudget.addEventListener('input', updateSliderDisplays);
        financingCalculator.securedFinancing.addEventListener('input', updateSliderDisplays);
        financingCalculator.croatiaSpend.addEventListener('input', updateSliderDisplays);

        function updateResults() {
          const projectType = financingCalculator.projectType.value;
          if (!projectType) return;
        
          const totalBudget = parseInt(financingCalculator.totalBudget.value, 10);
          const securedFinancing = parseInt(financingCalculator.securedFinancing.value, 10) / 100;
          const croatiaSpendPercentage = financingCalculator.croatiaSpend.value;
          const croatiaSpend = totalBudget * (parseInt(croatiaSpendPercentage, 10) / 100);
          const isMinorityCoproduction = financingCalculator.productionType.value === 'minority';
        
          let havcFinancing = 0;
          let localGrants = 0;
        
          if (isMinorityCoproduction) {
            havcFinancing = calculateHAVCFinancing(projectType, totalBudget, securedFinancing, croatiaSpendPercentage);
            localGrants = calculateLocalGrants(havcFinancing, securedFinancing, isMinorityCoproduction);
          }
        
          const incentiveProgramme = calculateIncentiveProgramme(projectType, totalBudget, croatiaSpend, securedFinancing);
        
          const totalPotentialFinancing = havcFinancing + localGrants + incentiveProgramme.rebate + incentiveProgramme.extraRebate;
          let budgetGap = totalBudget - totalPotentialFinancing - (securedFinancing * totalBudget);
        
          resultsDiv.innerHTML = `
          ${generateResultRow('HAVC Financing', formatCurrency(havcFinancing))}
          ${generateResultRow('Local Grants', formatCurrency(localGrants))}
          ${generateResultRow('Incentive Programme Rebate', formatCurrency(incentiveProgramme.rebate))}
          ${generateResultRow('Incentive Programme Extra Rebate', formatCurrency(incentiveProgramme.extraRebate))}
          ${generateResultRow('Total Potential Financing', formatCurrency(totalPotentialFinancing))}
          ${generateResultRow('Budget Gap', ' -' + formatCurrency(budgetGap))}
          `;
          resultsDiv.classList.add('visible');
        }
        const tooltips = {
          'HAVC Financing': 'HAVC financing is calculated based on project type and total budget. Minimum 50% secured financing, and 60% of approved financing must be spent in Croatia.',
          'Local Grants': 'Local municipalities can grant minimum amounts as a way to cover final and unexpected budget gaps.',
          // UPDATED 2026: tooltip clarified — the 80% cap applies to total budget, not to Croatian spend
          'Incentive Programme Rebate': '25% rebate on Croatian spend, capped at 80% of total production budget.',
          'Incentive Programme Extra Rebate': '5% extra rebate for spend in <a href="https://www.google.com/maps/d/u/0/edit?mid=1Ecu2iCgRhuzLLOGlsNEZu7x8cuzmYtY&usp=sharing" target="_BLANK">low-development regions</a>.',
          'Total Potential Financing': 'The results are strictly illustrative.',
          'Budget Gap': 'The results are strictly illustrative.',
        };
        function generateResultRow(title, value) {
          const tooltipContent = tooltips[title];
        
          return `
            <div class="result-row">
              <label for="totalBudget" class="input-section-title tooltip">
                <span>${title}</span>
                <p>€${value}</p>
                <span class="tooltip-text">${tooltipContent}</span>
              </label>
            </div>
          `;
        }
        toggleProductionType();
        updateResults();
        updateSliderDisplays();
        // Add event listeners to the radio buttons for projectType
        const projectTypeInputs = financingCalculator.projectType;
        for (const projectTypeInput of projectTypeInputs) {
          projectTypeInput.addEventListener('change', () => {
              updateResults();
              updateSliderDisplays();
          });
        }

        // Add event listeners to the sliders and the checkbox
        financingCalculator.totalBudget.addEventListener('input', updateResults);
        financingCalculator.securedFinancing.addEventListener('input', updateResults);
        financingCalculator.croatiaSpend.addEventListener('input', updateResults);
        //financingCalculator.minorityCoproduction.addEventListener('change', updateResults);

        function toggleProductionType() {
          const serviceRadio = document.querySelector('input[name="productionType"][value="service"]');
          const minorityRadio = document.querySelector('input[name="productionType"][value="minority"]');
          const handle = document.querySelector('.handle');
          const tekstlabels = document.getElementById("minorityorservice").getElementsByTagName("label");
          if (serviceRadio.checked) {
            minorityRadio.checked = true;
            handle.style.transform = 'translateX(30px)';
            tekstlabels[1].style.fontWeight="bold";
            tekstlabels[0].style.fontWeight="normal";
            tekstlabels[1].style.color="#c6504a";
            tekstlabels[0].style.color="black";
          } else {
            serviceRadio.checked = true;
            handle.style.transform = 'translateX(0)';
            tekstlabels[0].style.fontWeight="bold";
            tekstlabels[1].style.fontWeight="normal";
            tekstlabels[0].style.color="#c6504a";
            tekstlabels[1].style.color="black";
          }
          updateResults();
        }
        
        
        
});

function calculateHAVCFinancing(projectType, totalBudget, securedFinancing, croatiaSpendPercentage) {
  if (securedFinancing >= 0.85 || securedFinancing< 0.5) {
    return 0;
  }

  const croatiaSpend = totalBudget * (parseInt(croatiaSpendPercentage, 10) / 100);
  const minHAVCFinancingCroatia = croatiaSpend / 0.6; // 60% of financing must be spent in Croatia

  const additionalFinancingPoints = Math.max(0, securedFinancing - 0.5) * 10;
  const baseFinancing = 0.05 * totalBudget + additionalFinancingPoints * 0.01 * totalBudget;

  // NOTE: Min/max amounts retained from practical experience.
  // These specific thresholds are not published in the current Pravilnik (NN 95/2023)
  // but reflect typical award ranges observed in HAVC's 2023-2025 results.
  let minFinancing, maxFinancing;
  switch (projectType) {
    case 'feature':
    case 'featureDocumentary':
      minFinancing = 30000;
      maxFinancing = 75000;
      break;
    case 'short':
      minFinancing = 15000;
      maxFinancing = 50000;
      break;
    default:
      return 0;
  }

  const finalFinancing = Math.min(baseFinancing, minHAVCFinancingCroatia, maxFinancing);
  return Math.max(finalFinancing, minFinancing);
}


  
function calculateLocalGrants(havcFinancing, securedFinancing, isMinorityCoproduction) {
  if (!isMinorityCoproduction || securedFinancing < 0.75) {
    return 0;
  }

  const minFinancing = 10000;
  const maxFinancing = 25000;
  const havcMinFinancing = 30000;
  const havcMaxFinancing = 75000;

  const localGrantPercentage = (havcFinancing - havcMinFinancing) / (havcMaxFinancing - havcMinFinancing);
  const localGrantAmount = minFinancing + localGrantPercentage * (maxFinancing - minFinancing);

  return Math.max(minFinancing, Math.min(localGrantAmount, maxFinancing));
}



  
function calculateIncentiveProgramme(projectType, totalBudget, croatiaSpend, securedFinancing) {
  // UPDATED 2026: Minimum Croatian spend thresholds updated per Pravilnik o izmjenama
  // i dopunama Pravilnika o poticanju ulaganja u proizvodnju audiovizualnih djela (NN 9/2024)
  // effective February 1, 2024.
  //   - feature: 270000 → 250000
  //   - featureDocumentary: 67000 → 60000
  //   - animation: 67000 → 60000
  //   - tvFilm: 133000 → 150000
  //   - animatedTvSeries: 66000 → 60000
  //   - short: kept at 40000 (no longer separately categorized in regulation;
  //     value retained as practical estimate)
  const minSpends = {
    liveAction: 250000,
    documentary: 60000,
    animation: 60000,
    tvFilm: 150000,
    tvEpisodeFiction: 100000,
    tvEpisodeDocumentary: 60000,
    animatedTvSeries: 60000,
    feature: 250000,
    short: 40000,
    featureDocumentary: 60000
  };

  if (croatiaSpend < minSpends[projectType]) {
    return { rebate: 0, extraRebate: 0 };
  }

  const securedCroatianSpend = securedFinancing * totalBudget;
  if (securedCroatianSpend < 0.7 * croatiaSpend) {
    return { rebate: 0, extraRebate: 0 };
  }

  // FIXED 2026: Rebate base is the Croatian spend CAPPED at 80% of total budget,
  // per Pravilnik Article 3, paragraph 3: "The total amount of costs incurred in
  // the Republic of Croatia on which the refund is calculated cannot exceed 80%
  // of the total production budget of the audiovisual work."
  //
  // Previous (incorrect) logic used 0.4 * croatiaSpend as the rebate base,
  // which significantly underestimated rebates in most scenarios.
  const eligibleSpend = Math.min(croatiaSpend, 0.8 * totalBudget);
  const rebate = 0.25 * eligibleSpend;
  const extraRebate = 0.05 * eligibleSpend;

  return { rebate, extraRebate };
}


  function formatCurrency(number) {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  
    return formatter.format(number);
  }

  
  const projectTypes = document.querySelectorAll(".project-type");
const previousBtn = document.getElementById("previous-btn");
const nextBtn = document.getElementById("next-btn");

let selectedIndex = 0;

previousBtn.addEventListener("click", () => {
  projectTypes[selectedIndex].classList.remove("selected");
  selectedIndex = (selectedIndex - 1 + projectTypes.length) % projectTypes.length;
  projectTypes[selectedIndex].classList.add("selected");
  projectTypes[selectedIndex].querySelector("input").checked = true;
});

nextBtn.addEventListener("click", () => {
  projectTypes[selectedIndex].classList.remove("selected");
  selectedIndex = (selectedIndex + 1) % projectTypes.length;
  projectTypes[selectedIndex].classList.add("selected");
  projectTypes[selectedIndex].querySelector("input").checked = true;
});
