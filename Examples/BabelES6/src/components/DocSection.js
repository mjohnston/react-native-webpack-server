'use strict';

import React from 'react-native';

const {
  StyleSheet,
  Text,
  View,
  WebView,
} = React;

const BASE_URL = 'https://facebook.github.io/react-native/docs/';

export default class DocSection extends React.Component {

  static propTypes = {
    section: React.PropTypes.object.isRequired,
  };

  render() {
    const url = BASE_URL + this.props.section.id + '.html#content';
    return (
      <View style={styles.container}>
        <WebView style={styles.webView} url={url} startInLoadingState={true} />
      </View>
    );
  }

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  webView: {
    flex: 1,
  },
});
