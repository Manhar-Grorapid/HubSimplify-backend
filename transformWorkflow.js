const fs = require("fs");

const rawData = fs.readFileSync("./workflow.json");

const workflow = JSON.parse(rawData);

function getReadableType(action) {
    if (action.type === "LIST_BRANCH") {
        return "Branch Logic";
    }

    if (action.actionTypeId === "0-5") {
        return "Update Property";
    }

    if (action.actionTypeId === "0-15") {
        return "Enroll In Workflow";
    }

    return action.type;
}

const nodes = workflow.actions.map((action) => {

    let label = getReadableType(action);

    // property update actions
    if (action.fields?.property_name) {
        label += ` → ${action.fields.property_name}`;
    }

    // append/static values
    if (action.fields?.value?.staticAppendValue) {
        label += ` = ${action.fields.value.staticAppendValue}`;
    }

    if (action.fields?.value?.staticValue) {
        label += ` = ${action.fields.value.staticValue}`;
    }

    // enroll workflow action
    if (action.fields?.flow_id) {
        label += ` → Flow ID ${action.fields.flow_id}`;
    }

    return {
        id: action.actionId,
        label,
        type: action.type,
    };
});

const edges = [];

workflow.actions.forEach((action) => {

    // normal connections
    const nextActionId =
        action.connection?.nextActionId ||
        action.defaultBranch?.nextActionId;

    if (nextActionId) {
        edges.push({
            from: action.actionId,
            to: nextActionId,
            label: "Next",
        });
    }

    // branch connections
    if (action.listBranches) {
        action.listBranches.forEach((branch) => {
            edges.push({
                from: action.actionId,
                to: branch.connection.nextActionId,
                label: branch.branchName,
            });
        });
    }
});

function generateSummary(nodes, edges) {

    const summary = [];

    const updateActions = nodes.filter((node) =>
        node.label.includes("Update Property")
    );

    const branchActions = edges.filter(
        (edge) => edge.label !== "Next"
    );

    summary.push(
        `Workflow contains ${nodes.length} actions`
    );

    summary.push(
        `Workflow contains ${branchActions.length} branches`
    );

    summary.push("\nMain updates:");

    updateActions.forEach((action) => {
        summary.push(`- ${action.label}`);
    });

    return summary.join("\n");
}

console.log("\n========== SUMMARY ==========\n");

console.log(generateSummary(nodes, edges));

