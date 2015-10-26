'use strict';

import React from 'react-native';
import DocSection from './DocSection';
import docs from '../data/docs';

const {
  ListView,
  PixelRatio,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} = React;

export default class DocIndex extends React.Component {

  static propTypes = {
    navigator: React.PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);

    const sectionIDs = Object.keys(docs);
    const rowIDs = sectionIDs.map(id => docs[id].sections.map(s => s.id));
    const dataSource = new ListView.DataSource({
      rowHasChanged: (r1, r2) => r1 !== r2,
      sectionHeaderHasChanged: (s1, s2) => s1 !== s2,
      getSectionHeaderData: (docs, sectionID) => docs[sectionID],
      getRowData: (docs, sectionID, rowID) =>
        docs[sectionID].sections.filter(s => s.id === rowID)[0]
    }).cloneWithRowsAndSections(docs, sectionIDs, rowIDs);

    this.state = {dataSource};
  }

  render() {
    return (
      <ListView
        style={styles.container}
        dataSource={this.state.dataSource}
        renderSectionHeader={section => this.renderSectionHeader(section)}
        renderRow={row => this.renderRow(row)}
      />
    );
  }

  renderSectionHeader(section) {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {section.title}
        </Text>
      </View>
    );
  }

  renderRow(row) {
    return (
      <View style={styles.row}>
        <TouchableHighlight
          underlayColor='#f7f7f7'
          onPress={() => this.selectRow(row)}>
          <Text style={styles.rowTitle}>
            {row.title}
          </Text>
        </TouchableHighlight>
        <View style={styles.rowDivider} />
      </View>
    );
  }

  selectRow(section) {
    this.props.navigator.push({
      title: section.title,
      component: DocSection,
      passProps: {section},
    });
  }

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionHeader: {
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 14,
    paddingRight: 14,
    backgroundColor: '#eee',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  row: {
    position: 'relative',
  },
  rowTitle: {
    padding: 14,
    fontSize: 16,
    color: '#333',
  },
  rowDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1 / PixelRatio.get(),
    backgroundColor: '#ddd',
  },
});