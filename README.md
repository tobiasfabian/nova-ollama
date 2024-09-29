This Nova extension integrates [ollama](https://ollama.com) to help you *complete code* or *generate code* based on a prompt. This extension was developed to use code completion without external services, to ensure privacy and to be independent of online services.

The extension comes with two commands, `Assist` and `Complete code`.

<video src="https://github.com/tobiasfabian/nova-ollama/assets/1524319/6b3058e8-a9d1-4d1e-b511-e4943aac11c8" autoplay muted loop width="600"></video>

<video src="https://github.com/tobiasfabian/nova-ollama/assets/1524319/2de55322-989a-4e13-bf4e-660688d5ab09" autoplay muted loop width="600"></video>


## Requirements

**[ollama](https://ollama.com)** must be installed and running on your Mac. The model you want to use must be installed with ollama.

> You can start ollama with `ollama serve` (or start the desktop application).\
> If you don't already have the model you want to use installed, you can do this with `ollama pull llama3.2` (installs *llama3.2*).


## Usage

The **`Assist`** command opens an input request where you can type your prompt. Ollama will generate code based on your input. The generated code will be inserted at the current cursor position.

The **`Complete code`** command takes the selected code and tries to continue the code. If you don’t select any code, the code from the beginning of the file to the current cursor position will be used for the input prompt.

To run one of these commands
- Select the **Editor → ollama** menu item and click on `Assist` or `Complete code`
- Open **Command Palette …** (`shift + cmd + p`) and type `Assist` or `Complete code`

The `Assist` command is bind to `cmd + opt + ctrl + p`. To change the key binding, open the **Settings**, got to **Key Bindings** and search for *Assist*.

### Configuration

To configure global preferences, open **Extensions → Extension Library…** and select ollama's **Preferences** tab.

You can also configure preferences on a per-project basis in **Project → Project Settings…**.

#### Ollama URL
Default: `http://localhost:11434`

Set the origin URL where ollama is running. If you are not sure which URL ollama is running on, check the output of `ollama serve`. (e.g. `Listening on 127.0.0.1:11434 (version 0.1.24)`)

#### Model name
Default: `llama3.2`  
Example: `openhermes2.5-mistral:7b-q4_K_M`

The name of the model you want to use. The model must be installed. To install a new model run `ollama pull llama3.2` [ollama CLI Reference](https://github.com/ollama/ollama/blob/main/README.md#cli-reference)

Model names follow a model:tag format, where model can have an optional namespace such as example/model. The tag is optional and, if not provided, will default to latest. The tag is used to identify a specific version. [ollama API Docs](https://github.com/ollama/ollama/blob/main/docs/api.md#model-names)

#### Model parameters
Default: `{}`  
Example: `{ "num_predict": 256, "stop": "\n" }`

A JSON object containing [model parameters](https://github.com/ollama/ollama/blob/main/docs/api.md#generate-request-with-options).  
[Description of the parameters](https://github.com/ollama/ollama/blob/main/docs/modelfile.md#valid-parameters-and-values)

The example parameters will predict `256` tokens (default `128`) and stop the output on a line break `\n`.

#### Model keep alive
Default: `5m`

Controls how long the model will stay loaded into memory following the request

#### System message “Complete code”
Default: 
```
You are a code autocompletion engine. Respond with a continuation of the code provided and nothing else. Code should not be in a code block. Anything that is not code should be written as a code comment.
```

This system message is used when you run the “Complete code” command. You can try different messages to fine-tune the output.

#### System message “Assist”
Default: 
```
You are an assistant helping with coding. Respond with code only. Don’t format code. Don’t put code in code blocks. Don’t repeat the input.
```

This system message is used when you run the “Assist” command. You can try different messages to fine-tune the output.

### Privacy
This extension needs **Send Network Requests** permission to send and receive requests to the locally running ollama server. No data will be sent to external servers.
