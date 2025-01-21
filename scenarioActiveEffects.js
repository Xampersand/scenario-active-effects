async function applyScenarioActiveEffects(actor) {
    // Iterate through all items in the actor's inventory
    for (let item of actor.items) {
        // Check if the item has active effects with the 'isDynamic' flag
        const itemEffects = item.effects.filter(effect => effect.getFlag("scenario-active-effects", "isDynamic"));

        for (let effect of itemEffects) {
            // Iterate through the changes in the effect
            const changes = await Promise.all(effect.changes.map(async (change, index) => {
                // Get the formula for this change from the flags
                const formula = effect.getFlag("scenario-active-effects", `formula_${index}`);
                if (!formula) return change;  // If no formula, just return the original change

                try {
                    // Use Foundry's Roll class to evaluate the formula for this change
                    const roll = new Roll(formula, actor.getRollData());
                    await roll.evaluate();

                    // Return the updated change with the calculated value
                    return {
                        ...change,
                        value: roll.total // Apply the result of the formula to the change
                    };
                } catch (err) {
                    console.error(`Error calculating dynamic effect: ${err}`);
                    return change; // Return original change in case of error
                }
            }));

            // Update the effect with the new changes
            await effect.update({ changes });
        }
    }
}




Hooks.once("ready", () => {
    let logged = '%cScenario Active Effects%c has successfully loaded.'
    console.log(logged, 'color: #CF9FFF', 'color:rgb(116, 116, 116)');

    game.actors.contents.forEach(actor => applyScenarioActiveEffects(actor));
    Hooks.on("createActor", actor => applyScenarioActiveEffects(actor));
    Hooks.on("updateActor", actor => applyScenarioActiveEffects(actor));
    Hooks.on("itemEquipChange", actor => applyScenarioActiveEffects(actor));
    Hooks.on("updateDynamicEffects", actor => applyScenarioActiveEffects(actor));

    Hooks.on("renderActiveEffectConfig", (app, html, data) => {
        const effect = app.document;
        if (!effect) {
            console.error("Dynamic Active Effects: app.document is undefined.");
            return;
        }
        if (!(effect instanceof ActiveEffect)) {
            console.error("Dynamic Active Effects: app.document is not an instance of ActiveEffect:", effect);
            return;
        }
    
        // Get the current state of the 'isDynamic' flag
        const isDynamic = effect.getFlag('scenario-active-effects', 'isDynamic');
        
        // Prepare the dynamic effect checkbox UI
        const dynamicFormulaUI = `
        <div class="form-group">
            <label for="isDynamic">Dynamic Effect</label>
            <input type="checkbox" id="isDynamic" name="flags.scenario-active-effects.isDynamic" 
            ${isDynamic ? "checked" : ""}>
            <p class="notes">Mark this effect as dynamic to enable formula-based updates.</p>
        </div>
        `;
    
        // Add fields for each change's formula, initially hidden unless 'isDynamic' is checked
        const changeFormulas = effect.changes.map((change, index) => {
            const formula = effect.getFlag("scenario-active-effects", `formula_${index}`);
            return `
            <div class="form-group dynamicFormula" style="display: ${isDynamic ? 'block' : 'none'};">
                <label for="dynamicFormula${index}">Formula for Change ${index + 1}</label>
                <input type="text" id="dynamicFormula${index}" name="flags.scenario-active-effects.formula_${index}" 
                value="${formula || ""}">
            </div>
            `;
        }).join("");
    
        // Combine the UI elements and append them to the form
        const detailsTab = $(html).find(".tab[data-tab='details']");
        detailsTab.append(dynamicFormulaUI + changeFormulas);
    
        // Add event listener to toggle formula visibility when 'isDynamic' checkbox is toggled

        $(html).find("#isDynamic").on("change", function() {
            const isChecked = $(this).prop("checked");
            $(html).find(".dynamicFormula").each(function() {
                $(this).css("display", isChecked ? "block" : "none");
            });
        });
    });
});
