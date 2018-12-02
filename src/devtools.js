import React, { Component } from 'react';
import { render } from 'react-dom';
import fetch from 'node-fetch';
import { introspectionQuery } from 'graphql';
import LogContainer from './containers/LogContainer.jsx';
import styles from './../public/app.css';
import GraphQLContainer from './containers/GraphQLContainer';
import StateContainer from './containers/StateContainer.jsx';
import TreeDiagram from './components/TreeDiagram.jsx';
import recurseDiff from './stateDiff';
import StatePropsBox from './components/StatePropsBox';
import filter from './filterDOM';
import filterComponents from './filterComponents.js';

class App extends Component {
  constructor() {
    super();
    this.state = {
      window: 'Graphql',
      logs: [],
      appReactDOM: [],
      // appFilteredDOM: [],
      appState: [],
      nodeData: [], 
      schema: 'GraphQL schema not available.',
      stateDiff: [],
      componentsToFilter: [],
      toggleRouter: false, 
      toggleRedux: false,
      toggleApollo: false
    };

    this.handleMouseOver = this.handleMouseOver.bind(this);
    this.handleApolloFilter = this.handleApolloFilter.bind(this);
    this.handleReduxFilter = this.handleReduxFilter.bind(this);
    this.handleRouterFilter = this.handleRouterFilter.bind(this);

    chrome.devtools.panels.create("Lucid", null, "devtools.html", panel => {
      panel.onShown.addListener((e) => {
        console.log(e);
      });
    });
  }

  componentDidMount() {
    const appState = this;

    let chromePort = chrome.runtime.connect({
      name: 'devtool-background-port'
    });

    chromePort.postMessage({
      name: 'connect',
      tabId: chrome.devtools.inspectedWindow.tabId
    });

    let timeout;
    chromePort.onMessage.addListener(req => {
      // * checks if the message it's receiving is about a change in the DOM
      console.log('req')
      if (req.type === 'appState') {
        console.log('appSTATE!')
        let oldstate = this.state.appReactDOM;
        appState.setState({ appReactDOM: req.msg });

        if (oldstate.length > 0) {
          let diff = recurseDiff(oldstate, this.state.appReactDOM);
          appState.setState({ stateDiff: diff });
        }

        //if there is an active setTimeout, clear it
        clearTimeout(timeout);

        timeout = setTimeout(() => {
          appState.setState({ appState: req.msg });
        }, 1000);
      }
    });

    chrome.devtools.network.onRequestFinished.addListener(function (httpReq) {
      if (httpReq.request.postData !== undefined) {
        let reqBody = JSON.parse(httpReq.request.postData.text);

        console.log('reqBody: ', reqBody);
        if (reqBody.variables && reqBody.query) {
          let log = {};
          log.req = httpReq.request;

          if (httpReq.response.content) {
            httpReq.getContent(responseBody => {
              if (responseBody === "") {
                log.res = "No response received";
              } else {
                const parsedResponseBody = JSON.parse(responseBody);
                log.res = parsedResponseBody;
                appState.setState({ logs: [...appState.state.logs, log] });
              }
            });
          }
        }
      }
    });
  }

  fetchSchemaFromGraphQLServer() {
    if (this.state.logs.length !== 0) {
      let url = this.state.logs[this.state.logs.length - 1].req.url;
      console.log("URL", url);

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: introspectionQuery })
      })
        .then(res => res.json())
        .then(json =>
          this.setState({
            schema: JSON.stringify(json.data)
          })
        );
    }
  }

  componentDidUpdate() {
    console.log(this.state.componentsToFilter, 
      'did componentsToFilter update?')
    if(this.state.toggleRedux === 'true' || this.state.toggleApollo === 'true' || this.state.toggleRouter === 'true') {
      this.filterOutComponents(); 
    }
    if (this.state.schema === "GraphQL schema not available.") {
      this.fetchSchemaFromGraphQLServer();
    }
  }


  // * Handles the tab click for tree and req/res window
  handleWindowChange() {
    if (this.state.window === 'Graphql') {
      this.setState({ window: 'React' });
      document.querySelector('#reactbtn').classList.remove('active');
      document.querySelector('#graphqlbtn').classList.add('active');
    } else {
      this.setState({ window: 'Graphql' });
      document.querySelector('#reactbtn').classList.add('active');
      document.querySelector('#graphqlbtn').classList.remove('active');
    }
  }

  //handle data coming back from mouse hover in tree diagram
  handleMouseOver(data) {
    this.setState({
      nodeData: data
    })
  }

  filterOutComponents() {
    let data = this.state.appState; 
    if(this.state.componentsToFilter.length) {
      let result = []; 
      let output = filter(data, this.state.componentsToFilter, result);
      this.setState({
        appState: output
      });
    }
  }

  handleApolloFilter(arr) {
    //* if first index of arr is not in componentsToFilter arr, set incoming array to componentsToFilter
    if(!this.state.componentsToFilter.includes(arr[0]) && arr[0] === 'ApolloProvider') {
      console.log('did i hit apollo?')
      let componentsArr = this.state.componentsToFilter.concat(arr);
      this.setState({
        componentsToFilter: componentsArr, 
        toggleApollo: true
      })  
    }
    else {
      console.log('did i hit else?')
      //* if componentsToFilter is not empty iterate through 
      let list = this.state.componentsToFilter;
      let output = [];
      for (let i = 0; i < list.length; i++) {
        if (!arr.includes(list[i])) {
          output.push(list[i]);
          console.log(output, 'this is final list-------------')
        }
      }
      console.log(this.state.componentsToFilter, 'THIS IS AFTER CLICKS')
      this.setState({
        componentsToFilter: output
      })
    }
  }

  handleReduxFilter(arr) {
    //* if first index of arr is not in componentsToFilter arr, set incoming array to componentsToFilter
    if(!this.state.componentsToFilter.includes(arr[0]) && arr[0] === 'Provider') {
      console.log('did i hit redux?')
      let componentsArr = this.state.componentsToFilter.concat(arr);
      this.setState({
        componentsToFilter: componentsArr, 
        toggleApollo: true
      })  
    }
    else {
      console.log('did i hit else?')
      //* if componentsToFilter is not empty iterate through 
      let list = this.state.componentsToFilter;
      let output = [];
      for (let i = 0; i < list.length; i++) {
        if (!arr.includes(list[i])) {
          output.push(list[i]);
          console.log(output, 'this is final list-------------')
        }
      }
      console.log(this.state.componentsToFilter, 'THIS IS AFTER CLICKS')
      this.setState({
        componentsToFilter: output
      })
    }
  }

  handleRouterFilter(arr) {
    //* if first index of arr is not in componentsToFilter arr, set incoming array to componentsToFilter
    if(!this.state.componentsToFilter.includes(arr[0]) && arr[0] === 'BrowserRouter') {
      console.log('did i hit router?')
      let componentsArr = this.state.componentsToFilter.concat(arr);
      this.setState({
        componentsToFilter: componentsArr, 
        toggleApollo: true
      })  
    }
    else {
      console.log('did i hit else?')
      //* if componentsToFilter is not empty iterate through 
      let list = this.state.componentsToFilter;
      let output = [];
      for (let i = 0; i < list.length; i++) {
        if (!arr.includes(list[i])) {
          output.push(list[i]);
          console.log(output, 'this is final list-------------')
        }
      }
      console.log(this.state.componentsToFilter, 'THIS IS AFTER CLICKS')
      this.setState({
        componentsToFilter: output
      })
    }
  }

  render() {
    console.log('devtoolsjs re-rendered; this.state:', this.state);
    //if this.state.appState has not been populated by reactTraverser.js, show a message asking users to setState(), else render App (Log, Tree, GraphQL)
    return (
      <div>
        {this.state.appState.length === 0 ?
          <div id='devToolsLoader'>
            <h1>Please trigger a setState() to activate Lucid devtool.<br /></h1>
            <p>Lucid works best on React v15/16</p>
          </div>
          :
          <div id='app-container'>
            <div id='window'>
              <div id='window-nav'>
                <span class='window-btn-wrapper'>
                  <button className='window-btn active' id='reactbtn' onClick={() => { this.handleWindowChange(); }}>GraphQL</button>
                </span>
                <span class='window-btn-wrapper'>
                  <button className='window-btn' id='graphqlbtn' onClick={() => { this.handleWindowChange(); }}>Component Tree</button>
                </span>
              </div>

              {/* This checks what window the user has click on. 
              They can click to see the state tree or 
              request/reponse from their httprequest */}
              {this.state.window === 'Graphql' ? (
                <div class='graphQLTab'>
                  <LogContainer logs={this.state.logs} />
                  <GraphQLContainer logs={this.state.logs} schema={this.state.schema} />
                </div>
              ) : (
                  <div class='reactTab'>
                    <StateContainer stateDiffs={this.state.stateDiff}/>
                    <TreeDiagram appState={this.state.appState} handleMouseOver={this.handleMouseOver} handleApolloFilter={this.handleApolloFilter} handleReduxFilter={this.handleReduxFilter} handleRouterFilter={this.handleRouterFilter}/>
                    <StatePropsBox nodeData = {this.state.nodeData}/>
                  </div>
                )}
            </div>
          </div>
        }
      </div>
    );
  }
}



render(<App />, document.getElementById('root'));
