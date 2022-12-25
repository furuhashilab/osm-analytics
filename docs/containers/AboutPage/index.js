import React, { Component } from 'react'
import About from '../../components/About'

class AboutPage extends Component {
  render() {
    const { actions, children } = this.props
    return (
      <About />
    )
  }
}

export default AboutPage
