'use strict';

import React from 'react-native';
import docs from '../data/docs';
import DocIndex from './DocIndex';

const {
  NavigatorIOS,
  View,
  Text,
  StyleSheet,
} = React;

export default class App extends React.Component {

  render() {
    return (
      <NavigatorIOS
        style={styles.container}
        initialRoute={{
          title: 'React Native Docs',
          component: DocIndex,
          passProps: {docs},
        }}
      />
    );
  }

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});