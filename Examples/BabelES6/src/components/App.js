'use strict';

import React from 'react-native';
import DocIndex from './DocIndex';

const {
  Navigator,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} = React;

export default class App extends React.Component {

  render() {
    return (
      <Navigator
        style={styles.container}
        initialRoute={{
          component: DocIndex,
          title: 'React Native Docs',
        }}
        renderScene={(route, navigator) =>
          <View style={styles.scene}>
            <route.component navigator={navigator} {...route.passProps} />
          </View>
        }
        navigationBar={
          <Navigator.NavigationBar
            routeMapper={{
              LeftButton: (route, navigator, index, navState) => index === 0 ? null : (
                <TouchableOpacity
                  onPress={() => navigator.pop()}
                  style={styles.navBarLeftButton}>
                  <Text style={[styles.navBarText, styles.navBarButtonText]}>
                    Back
                  </Text>
                </TouchableOpacity>
              ),
              RightButton: (route, navigator, index, navState) => (
                null
              ),
              Title: (route, navigator, index, navState) => (
                <Text style={styles.titleText}>
                  {route.title}
                </Text>
              ),
            }}
          />
        }
      />
    );
  }

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  navBarButtonText: {
    color: '#5890ff',
  },
  navBarLeftButton: {
    paddingLeft: 10,
  },
  navBarText: {
    fontSize: 16,
    marginVertical: 10,
  },
  scene: {
    paddingTop: 64,
    flex: 1,
  },
  titleText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
    lineHeight: 32,
  },
});
