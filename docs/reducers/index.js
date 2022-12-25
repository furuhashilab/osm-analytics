import { routerReducer as routing } from 'react-router-redux'
import { combineReducers } from 'redux'
import map from './map'
import stats from './stats'

export default combineReducers({
  routing,
  map,
  stats
})
