function getReadableType(action) {

    // branch logic
    if (action.type === "LIST_BRANCH") {
        return "Decision";
    }

    // property updates
    if (action.actionTypeId === "0-5") {
        return "Update Property";
    }

    // enroll workflow
    if (action.actionTypeId === "0-15") {
        return "Enroll Workflow";
    }

    // send internal email
    if (action.actionTypeId === "0-1") {
        return "Send Internal Email";
    }

    // task creation
    if (action.actionTypeId === "0-4") {
        return "Create Task";
    }

    // delay
    if (
        action.type === "DELAY" ||
        action.actionTypeId === "0-8"
    ) {
        return "Delay";
    }

    // webhook
    if (action.actionTypeId === "0-31") {
        return "Webhook";
    }

    // generic fallback
    if (action.type === "SINGLE_CONNECTION") {

        if (action.fields?.property_name) {
            return "Update Property";
        }

        if (
            action.fields?.emailId ||
            action.fields?.email_id
        ) {
            return "Send Email";
        }

        return "Workflow Action";
    }

    return "Workflow Action";
}

function transformWorkflow(workflow) {

    const nodes = workflow.actions.map((action, index) => {

        let label = getReadableType(action);

        // property updates
        if (action.fields?.property_name) {
            label += ` → ${action.fields.property_name}`;
        }

        // append values
        if (action.fields?.value?.staticAppendValue) {
            label += ` = ${action.fields.value.staticAppendValue}`;
        }

        // static values
        if (action.fields?.value?.staticValue) {
            label += ` = ${action.fields.value.staticValue}`;
        }

        // enroll workflow
        if (action.fields?.flow_id) {
            label += ` → Flow ID ${action.fields.flow_id}`;
        }

        return {

            id: String(action.actionId),

            position: {
                x:
                    index === 0
                        ? 400
                        : 150 + (index - 1) * 220,

                y:
                    index === 0
                        ? 80
                        : 320,
            },

            data: {
                label,
            },

            type: "default",
        };
    });

    const edges = [];

    workflow.actions.forEach((action) => {

        // normal/default connection
        const nextActionId =
            action.connection?.nextActionId ||
            action.defaultBranch?.nextActionId;

        if (nextActionId) {

            edges.push({

                id: `e-${action.actionId}-${nextActionId}`,

                source: String(action.actionId),

                target: String(nextActionId),

                label:
                    action.type === "LIST_BRANCH"
                        ? "Default"
                        : "Next",

                animated: true,
            });
        }

        // branch connections
        if (action.listBranches) {

            action.listBranches.forEach((branch) => {

                const nextId =
                    branch?.connection?.nextActionId;

                if (!nextId) return;

                edges.push({

                    id: `e-${action.actionId}-${nextId}`,

                    source: String(action.actionId),

                    target: String(nextId),

                    label:
                        branch.branchName || "Branch",

                    animated: true,
                });
            });
        }
    });

    // semantic business-readable steps
    const semanticSteps = [];

    // branch-based workflows
    edges.forEach((edge) => {

        if (
            edge.label === "Next" ||
            edge.label === "Default"
        ) {
            return;
        }

        const targetNode =
            nodes.find(
                (n) => n.id === edge.target
            );

        if (!targetNode) return;

        semanticSteps.push({
            condition: `If ${edge.label}`,
            action: targetNode.data.label,
        });
    });

    // fallback for simple workflows
    if (semanticSteps.length === 0) {

        workflow.actions.forEach((action) => {

            semanticSteps.push({

                condition:
                    getReadableType(action),

                action:
                    getReadableType(action),
            });
        });
    }

    const summary = {

        totalActions:
            workflow.actions.length,

        totalBranches:
            workflow.actions.filter(
                (a) => a.type === "LIST_BRANCH"
            ).length,

        actionTypes: [
            ...new Set(
                workflow.actions.map((a) =>
                    getReadableType(a)
                )
            ),
        ],

        workflowType:
            workflow.actions.some(
                (a) => a.type === "LIST_BRANCH"
            )
                ? "Branching Workflow"
                : "Linear Workflow",
    };

    return {
        workflowName: workflow.name,
        summary,
        semanticSteps,
        nodes,
        edges,
    };
}

module.exports = transformWorkflow;