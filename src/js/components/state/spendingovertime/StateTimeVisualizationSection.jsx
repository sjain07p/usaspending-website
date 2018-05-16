/**
 * StateTimeVisualizationSection.jsx
 * Created by David Trinh 5/15/18
 */

import React from 'react';
import PropTypes from 'prop-types';
import { throttle } from 'lodash';

import StateTimeVisualizationPeriodButton from './StateTimeVisualizationPeriodButton';

import StateTimeVisualization from './StateTimeVisualization';

const propTypes = {
    data: PropTypes.object,
    xSeries: PropTypes.array,
    loading: PropTypes.bool,
    visualizationPeriod: PropTypes.string,
    updateVisualizationPeriod: PropTypes.func
};

export default class StateTimeVisualizationSection extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            windowWidth: 0,
            visualizationWidth: 0
        };

        this.handleWindowResize = throttle(this.handleWindowResize.bind(this), 50);
    }

    componentDidMount() {
        this.handleWindowResize();
        window.addEventListener('resize', this.handleWindowResize);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleWindowResize);
    }

    handleWindowResize() {
        // determine if the width changed
        const windowWidth = window.innerWidth;
        if (this.state.windowWidth !== windowWidth) {
            // width changed, update the visualization width
            this.setState({
                windowWidth,
                visualizationWidth: this.sectionHr.offsetWidth
            });
        }
    }

    render() {
        return (
            <div
                className="results-visualization-time-section"
                id="results-section-time">
                <h3>Awards Over Time</h3>
                <hr
                    className="results-divider"
                    ref={(hr) => {
                        this.sectionHr = hr;
                    }} />
                <div className="content">
                    <ul>
                        <li>
                            <StateTimeVisualizationPeriodButton
                                value="fiscal_year"
                                label="Years"
                                active={this.props.data.visualizationPeriod === 'fiscal_year'}
                                updateVisualizationPeriod={this.props.updateVisualizationPeriod} />
                        </li>
                        <li>
                            <StateTimeVisualizationPeriodButton
                                value="quarter"
                                label="Quarters"
                                active={this.props.data.visualizationPeriod === 'quarter'}
                                updateVisualizationPeriod={this.props.updateVisualizationPeriod} />
                        </li>
                        <li>
                            <StateTimeVisualizationPeriodButton
                                value="month"
                                label="Months"
                                active={this.props.data.visualizationPeriod === 'month'}
                                updateVisualizationPeriod={this.props.updateVisualizationPeriod} />
                        </li>
                    </ul>
                </div>

                <div className="visualization-top">
                    <div className="visualization-description">
                        <div className="content">
                            Spot trends in spending over your chosen time period. Filter your
                            results more (at left) and watch this graph update automatically. Break
                            down your results by years or quarters.
                        </div>
                    </div>
                </div>
                <StateTimeVisualization
                    visualizationPeriod={this.props.visualizationPeriod}
                    loading={this.props.loading}
                    data={this.props.data}
                    width={this.state.visualizationWidth} />
            </div>
        );
    }
}

StateTimeVisualizationSection.propTypes = propTypes;
