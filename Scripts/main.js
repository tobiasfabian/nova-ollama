/* global exports */
/* global nova */
/* global NotificationRequest */

const encoder = new TextDecoder();

// Toggle which controls insertStream()
let continueReading = true;


const getApiUrl = () => {
	let ollamaOrigin = nova.workspace.config.get('tobiaswolf.ollama.origin') ?? nova.config.get('tobiaswolf.ollama.origin') ?? 'http://localhost:11434'
	return `${ollamaOrigin}/api`;
}

const getModelName = () => {
	return nova.workspace.config.get('tobiaswolf.ollama.modelName') ?? nova.config.get('tobiaswolf.ollama.modelName') ?? 'llama2'
}

const getModelParameters = () => {
	return JSON.parse(nova.workspace.config.get('tobiaswolf.ollama.modelParameters') ?? nova.config.get('tobiaswolf.ollama.modelParameters') ?? '{}');
}

const getModelKeepAlive = () => {
	return nova.workspace.config.get('tobiaswolf.ollama.modelKeepAlive') ?? nova.config.get('tobiaswolf.ollama.modelKeepAlive') ?? '5m'
}

const checkIfModelExists = async () => {
	try {
		const response = await fetch(`${getApiUrl()}/show`, {
			method: 'post',
			body: JSON.stringify({
				name: getModelName(),
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
		openCancelNotificationRequest();
		const modelName = getModelName();
		const apiUrl = getApiUrl();

		if (input === '') {
			console.log(`No input provided. ${input}`);
			return;
		}

		const modelParameters = getModelParameters();
		const keepAlive = getModelKeepAlive();
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
		}).catch((exception) => {
			console.log(exception);
			showError(exception);
		});

		console.log('Response status', response.status)

		if (!response.ok) {
			const exception = `Response status: ${response.status} (Model: ${modelName}, URL: ${apiUrl})`;
			nova.notifications.cancel('ollama-cancel-request');
			console.error(exception);
			showError(exception);
			return false;
		}

		return response;
	} catch (exception) {
		console.error(exception);
		nova.notifications.cancel('ollama-cancel-request');
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

const interruptCodeGeneration = () => {
	// set continueReading toggle
	continueReading = false;
}

const insertStream = async (reader, editor) => {
	return await new Promise((resolve, reject) => {
		let responseText = '';
		const startInputPosition = editor.selectedRange.end;
		let inputPosition = startInputPosition;

		const readStream = () => {
			if (continueReading === false) {
				// reset continueReading toggle
				continueReading = true;

				const inputRange = new Range(startInputPosition, startInputPosition + responseText.length);
				editor.addSelectionForRange(inputRange);

				return reject('Stream reading interrupted');
			}

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
					nova.notifications.cancel('ollama-cancel-request');
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



const openCancelNotificationRequest = async () => {
	const notificationRequest = new NotificationRequest("ollama-cancel-request");
	notificationRequest.title = nova.localize("Cancel output?");
	notificationRequest.actions = [nova.localize("Cancel output")];

	const promise = nova.notifications.add(notificationRequest);
	promise.then(async (reply) => {
		if (reply.actionIdx === 0) {
			console.info('Cancel output');
			interruptCodeGeneration();
		}
	});
}

const completeCode = async (editor) => {
	try {
		var selectedRange = editor.selectedRange;
		const selectedText = editor.selectedText;
		let input = selectedText;
		if (selectedText === '') {
			// get text from cursor to beginning of file
			input = editor.getTextInRange(new Range(0, selectedRange.end));
		}
		const systemMessageCompleteCode = nova.config.get('tobiaswolf.ollama.systemMessageCompleteCode');
		const response = await requestOllama(input, systemMessageCompleteCode);
		const responseText = await insertStream(response.body.getReader(), editor);
	} catch (exception) {
		console.error(exception);
	}
}

const openAssistant = async (editor) => {
	try {
		const syntax = editor.document.syntax;

		const selectedText = editor.selectedText;
		let inputMessage = 'Write a command.';

		if (selectedText !== '') {
			inputMessage = 'Write a command, selected text is added to the end of the command.';
		}

		nova.workspace.showInputPalette(inputMessage, {
			value: syntax ? `${syntax}: ` : null,
			placeholder: 'JS: Fetch request with json reponse.',
		}, async (input) => {
			console.log(input);
			if (input) {
				if (selectedText !== '') {
					input += `

					${selectedText}
					`
				}
				try {
					const systemMessageAssist = nova.config.get('tobiaswolf.ollama.systemMessageAssist');
					const response = await requestOllama(input, systemMessageAssist)
					const responseText = await insertStream(response.body.getReader(), editor);
				} catch (exception) {
					console.error(exception);
				}
			}
		});
	} catch (exception) {
		console.error(exception);
	}
};


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
