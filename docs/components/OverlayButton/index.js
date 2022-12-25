import React, { Component } from 'react'
import DropdownButton from '../DropdownButton'

import { overlays } from '../../settings/options'


class OverlayButton extends Component {
  render() {
    var btn = <p>{overlays.find(overlay => overlay.id === this.props.enabledOverlay).description}&ensp;▾</p>
    return (
      <DropdownButton
        options={overlays}
        multiple={false}
        selectedKeys={['number']}
        btnElement={btn}
        selectedKeys={[this.props.enabledOverlay]}
        onSelectionChange={::this.handleDropdownChanges}
        className="overlays-dropdown"
      />
    )
  }

  handleDropdownChanges(selectedKeys) {
    const selectedOverlay = selectedKeys[0]
    this.props.setOverlay(selectedOverlay)
    if (selectedOverlay !== this.props.enabledOverlay) {
      this.props.setExperienceFilter(null)
      this.props.setTimeFilter(null)
    }
  }
}

export default OverlayButton
