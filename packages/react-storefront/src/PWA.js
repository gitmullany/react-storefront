/**
 * @license
 * Copyright © 2017-2018 Moov Corporation.  All rights reserved.
 */
import React, { Component, Fragment } from 'react'
import { inject, observer, Provider } from 'mobx-react'
import { Helmet } from 'react-helmet'
import withStyles from '@material-ui/core/styles/withStyles'
import CssBaseline from '@material-ui/core/CssBaseline'
import { canUseClientSideNavigation } from './utils/url'
import delegate from 'delegate'
import { cache } from './router/serviceWorker'
import { isSafari } from './utils/browser'

/**
 * @private
 * Internal PWA root used when launching the app.  Do not use this class directly
 */
export const styles = theme => ({
  '@global': {
    'body.moov-modal': {
      overflow: 'hidden',
      position: 'fixed',
      maxWidth: '100vw',
      maxHeight: '100vh'
    },
    'body.moov-blur #root': {
      filter: 'blur(5px)',
      transition: `filter ${theme.transitions.duration.enteringScreen}ms`
    }
  }
});

@withStyles(styles)
@inject(({ app, history }) => ({ menu: app.menu, app, history, amp: app.amp }))
@observer
export default class PWA extends Component {
  
  _nextId = 0

  render() {
    const { amp, app } = this.props

    return (
      <Provider nextId={this.nextId}>
        <Fragment>
          <CssBaseline/>
          <Helmet>
            <title>{app.title}</title>
            <meta name="description" content={app.description} />
            <html lang="en"/>
          </Helmet>
          { amp && (
            <Helmet>
              <script async src="https://cdn.ampproject.org/v0.js"></script>
              <script async custom-element="amp-install-serviceworker" src="https://cdn.ampproject.org/v0/amp-install-serviceworker-0.1.js"></script>
            </Helmet>
          )}
          { amp && (
            <amp-install-serviceworker
              src={`https://${app.location.hostname}/service-worker.js`}
              data-iframe-src={`https://${app.location.hostname}/pwa/install-service-worker.html`}
              layout="nodisplay">
            </amp-install-serviceworker>
          )}
            {this.props.children}
        </Fragment>
      </Provider>
    )
  }

  nextId = () => {
    return this._nextId++
  }

  componentDidCatch(error, info) {
    const { app } = this.props

    app.applyState({
      page: 'Error',
      error: error.message,
      stack: info.componentStack
    })
  }

  componentDidMount() {
    // Send state to service worker to cache
    this.props.history.listen(this.onRouteChange)
    this.watchLinkClicks()

    // put os class on body for platform-specific styling
    this.addDeviceClassesToBody()

    // cache the launch screen for when the pwa is installed on the desktop
    cache('/?source=pwa')
  }

  /**
   * Adds a css class corresponding to the browser to the body element
   * @private
   */
  addDeviceClassesToBody() {
    if (isSafari()) {
      document.body.classList.add('moov-safari')
    }
  }

  /**
   * Returns true if client-side navigation should be forced, otherwise false
   * @param {HTMLElement} linkEl
   * @return {Boolean} 
   */
  shouldNavigateOnClient(linkEl) {
    const href = linkEl.getAttribute('href')
    const linkTarget = linkEl.getAttribute('target')

    // false if the element is not a link
    if (linkEl.tagName.toLowerCase() !== 'a') return false

    // false if the link was rendered by react-storefront/Link - it will handle nav on its own
    if (linkEl.getAttribute('data-moov-link') === 'on') return false

    // false if link has data-reload="on|true"
    if (['true', 'on'].indexOf(linkEl.getAttribute('data-reload')) !== -1) return false

    // false for links with a target other than self
    if (linkTarget && linkTarget !== '_self') return false

    return canUseClientSideNavigation(href)
  }

  /**
   * Watches for clicks on all links and forces client-side navigation if the domain is the same.
   * This behavior can be overridden by adding data-reload="on" to any link
   */
  watchLinkClicks() {
    // capture click events
    delegate('a', 'click', e => {
      const { delegateTarget } = e

      if (this.shouldNavigateOnClient(delegateTarget)) {
        // don't reload the page
        e.preventDefault()

        // instead do the navigation client-side using the history API
        this.props.history.push(delegateTarget.getAttribute('href'))
      }
    })
  }

  onRouteChange = (_location, action) => {
    if (action === 'PUSH') {
      window.scrollTo(0, 0)
      this.props.menu.close()
    }
  }

}
