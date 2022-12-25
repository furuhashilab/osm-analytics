import { compose, createStore, applyMiddleware } from 'redux'
//import persistState from 'redux-localstorage'

import { logger } from '../middleware'
import rootReducer from '../reducers'

export default function configure(initialState) {
  const createDevStore = window.devToolsExtension
    ? window.devToolsExtension()(createStore)
    : createStore

  const createStoreWithMiddleware = applyMiddleware(
    logger
  )(createDevStore)

  //const createPersistentStore = compose(
  //  persistState(['filters'] /*paths, config*/)
  //)(createStoreWithMiddleware)

  const store = createStoreWithMiddleware(rootReducer, initialState)

  if (module.hot) {
    module.hot.accept('../reducers', () => {
      const nextReducer = require('../reducers')
      store.replaceReducer(nextReducer)
    })
  }

  return store
}
