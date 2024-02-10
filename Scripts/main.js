/* global exports */
/* global nova */
/* global NotificationRequest */

const encoder = new TextDecoder();

let ollamaOrigin = nova.config.get('tobiaswolf.ollama.origin') ?? 'http://localhost:11434';
let apiUrl = `${ollamaOrigin}/api`;
let modelName = nova.config.get('tobiaswolf.ollama.modelName') ?? llama2;

const checkIfModelExists = async () => {
	try {
		const response = await fetch(`${apiUrl}/show`, {
			method: 'post',
			body: JSON.stringify({
				name: modelName,
			}),
		});
		console.log('🦙 ollama model check:', response.ok ? 'ok' : 'failed');
		const json = await response.json();
		if (!response.ok) {
			showError(json.error);
			console.error(JSON.stringify(json));
		} else {
			console.info('Model status', JSON.stringify(json));
		}
	} catch(exception) {
		showError(exception);
		console.error(exception);
	}
}

const showError = async (message) => {
	const notificationRequest = new NotificationRequest("ollama-error");
	notificationRequest.title = 'Ollama error';
	notificationRequest.body = message;
	nova.notifications.add(notificationRequest);
}

const requestOllama = async (input, apiSystem) => {
	try {
		if (input === '') {
			console.log(`No input provided. ${input}`);
			return;
		}

		const modelParameters = JSON.parse(nova.config.get('tobiaswolf.ollama.modelParameters') ?? '{}');
		const keepAlive = nova.config.get('tobiaswolf.ollama.modelKeepAlive') ?? '5m';
		console.log(`Start request for “${input}” [${modelName} (${JSON.stringify(modelParameters)}): ${apiSystem}]`);

		const response = await fetch(`${apiUrl}/generate`, {
			method: 'POST',
			body: JSON.stringify({
				model: modelName,
				prompt: input,
				system: apiSystem,
				stream: true,
				options: modelParameters,
				keep_alive: keepAlive,
			}),
		}).catch((error) => {
			console.log(error);
		});

		console.log('Response status', response.status)

		return response;
	} catch (exception) {
		console.error(exception);
		showError(exception);
	}
}

const cleanResponseText = (responseText, editor) => {
	if (editor.softTabs === false) {
		// replace spaces with tab
		responseText = responseText.replace(/ {2}/g, '\t');
		responseText = responseText.replace(/ {4}/g, '\t');
	}
	responseText = responseText.replace(/```\w+\n/g, '');
	responseText = responseText.replace(/```\w+/g, '');
	responseText = responseText.replace(/```\n/g, '');
	responseText = responseText.replace(/```/g, '');
	return responseText;
}

const insertStream = async (reader, editor) => {
	return await new Promise((resolve, reject) => {
		let responseText = '';
		const startInputPosition = editor.selectedRange.end;
		let inputPosition = startInputPosition;

		const readStream = () => {
			reader.read().then(async ({ done, value }) => {
				const data = JSON.parse(encoder.decode(value));
				let responseTextChunk = data.response;

				console.log(responseTextChunk);
				responseText += responseTextChunk;
				await editor.edit(async (textEditorEdit) => {
					textEditorEdit.insert(inputPosition, responseTextChunk);
					inputPosition += responseTextChunk.length;
				}).catch((exception) => {
					console.error(exception);
				});

				if (done || data.done) {
					console.log('Stream reading complete', responseText);
					// select input
					let newInputRange = new Range(startInputPosition, startInputPosition + responseText.length);

					responseText = cleanResponseText(responseText, editor)

					// replace spaces with tabs
					await editor.edit(async (textEditorEdit) => {
						textEditorEdit.replace(newInputRange, responseText);
					}).catch((exception) => {
						console.error(exception);
					});

					newInputRange = new Range(startInputPosition, startInputPosition + responseText.length);

					editor.addSelectionForRange(newInputRange);
					resolve(responseText);
				} else {
					readStream();
				}
			}).catch(error => {
				reject(error);
				console.error('Error reading stream:', error);
			});
		}

		// Start reading the stream
		readStream();
	});
}

const completeCode = async (editor) => {
	var selectedRanges = editor.selectedRanges.reverse();
	for (var range of selectedRanges) {
		// get selected text
		let input = editor.getTextInRange(range);
		if (input === '') {
			// get text from cursor to beginning of file
			input = editor.getTextInRange(new Range(0, range.end));
		}
		const systemMessageCompleteCode = nova.config.get('tobiaswolf.ollama.systemMessageCompleteCode');
		const response = await requestOllama(input, systemMessageCompleteCode);
		const responseText = await insertStream(response.body.getReader(), editor);
	}
}

const openAssistant = async (editor) => {
	let notificationRequest = new NotificationRequest("ollama-assistant");
	const syntax = editor.document.syntax;

	notificationRequest.title = nova.localize("How can I assist you?");
	notificationRequest.body = nova.localize(`Language: ${syntax}`);

	if (syntax) {
		notificationRequest.textInputValue = `${syntax}: `;
	}

	notificationRequest.type = "input";
	notificationRequest.actions = [nova.localize("OK"), nova.localize("Cancel")];

	let promise = nova.notifications.add(notificationRequest);
	promise.then(async (reply) => {
		if (reply.actionIdx === 0) {
			const systemMessageAssist = nova.config.get('tobiaswolf.ollama.systemMessageAssist');
			const response = await requestOllama(reply.textInputValue, systemMessageAssist)
			const responseText = await insertStream(response.body.getReader(), editor);
		}
	}, error => {
		console.error(error);
	});
};


// Listen to setting changes

nova.config.onDidChange('tobiaswolf.ollama.origin', (disposable) => {
	ollamaOrigin = disposable;
	apiUrl = `${ollamaOrigin}/api`;
	console.log(apiUrl);
	checkIfModelExists();
});
nova.config.onDidChange('tobiaswolf.ollama.modelName', (disposable) => {
	modelName = disposable;
	checkIfModelExists();
});


// Add commands

nova.subscriptions.add(
	nova.commands.register("tobiaswolf.ollama.completeCode", async (editor) => completeCode(editor))
)
nova.subscriptions.add(
	nova.commands.register("tobiaswolf.ollama.assist", async (editor) => openAssistant(editor))
)


// Check model on activation

exports.activate = async function() {
	console.log('🦙 ollama extension is active');
	checkIfModelExists();
}
