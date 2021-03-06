﻿/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved. 
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *   
 *  The above copyright notice and this permission notice shall be included in 
 *  all copies or substantial portions of the Software.
 *   
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

/// <reference path="../_references.ts"/>

module powerbi.visuals {
    import Selector = powerbi.data.Selector;

    /**
     * A helper class for building a VisualObjectInstanceEnumerationObject:
     * - Allows call chaining (e.g., builder.pushInstance({...}).pushInstance({...})
     * - Allows creating of containers (via pushContainer/popContainer)
     */
    export class ObjectEnumerationBuilder {
        private instances: VisualObjectInstance[];
        private containers: VisualObjectInstanceContainer[];
        private containerIdx: number;

        public pushInstance(instance: VisualObjectInstance): ObjectEnumerationBuilder {
            debug.assertValue(instance, 'instance');

            let instances = this.instances;
            if (!instances) {
                instances = this.instances = [];
            }

            let containerIdx = this.containerIdx;
            if (containerIdx != null) {
                instance.containerIdx = containerIdx;
            }

            // Attempt to merge with an existing item if possible.
            for (let existingInstance of instances) {
                if (this.canMerge(existingInstance, instance)) {
                    this.extend(existingInstance, instance, 'properties');
                    this.extend(existingInstance, instance, 'validValues');

                    return this;
                }
            }

            instances.push(instance);

            return this;
        }

        public pushContainer(container: VisualObjectInstanceContainer): ObjectEnumerationBuilder {
            debug.assertValue(container, 'container');

            let containers = this.containers;
            if (!containers) {
                containers = this.containers = [];
            }

            let updatedLen = containers.push(container);
            this.containerIdx = updatedLen - 1;

            return this;
        }

        public popContainer(): ObjectEnumerationBuilder {
            this.containerIdx = undefined;

            return this;
        }

        public complete(): VisualObjectInstanceEnumerationObject {
            if (!this.instances)
                return;

            let result: VisualObjectInstanceEnumerationObject = {
                instances: this.instances,
            };

            let containers = this.containers;
            if (containers) {
                result.containers = containers;
            }

            return result;
        }

        private canMerge(x: VisualObjectInstance, y: VisualObjectInstance): boolean {
            debug.assertValue(x, 'x');
            debug.assertValue(y, 'y');

            return x.objectName === y.objectName &&
                x.containerIdx === y.containerIdx &&
                Selector.equals(x.selector, y.selector);
        }

        private extend(target: VisualObjectInstance, source: VisualObjectInstance, propertyName: string): void {
            debug.assertValue(target, 'target');
            debug.assertValue(source, 'source');
            debug.assertValue(propertyName, 'propertyName');

            let sourceValues = source[propertyName];
            if (!sourceValues)
                return;

            let targetValues = target[propertyName];
            if (!targetValues)
                targetValues = target[propertyName] = {};

            for (let valuePropertyName in sourceValues) {
                if (targetValues[valuePropertyName]) {
                    // Properties have first-writer-wins semantics.
                    continue;
                }

                targetValues[valuePropertyName] = sourceValues[valuePropertyName];
            }
        }

        public static merge(x: VisualObjectInstanceEnumeration, y: VisualObjectInstanceEnumeration): VisualObjectInstanceEnumerationObject {
            let xNormalized = ObjectEnumerationBuilder.normalize(x);
            let yNormalized = ObjectEnumerationBuilder.normalize(y);

            if (!xNormalized || !yNormalized)
                return xNormalized || yNormalized;

            debug.assertValue(xNormalized, 'xNormalized');
            debug.assertValue(yNormalized, 'yNormalized');

            let xCategoryCount = xNormalized.containers ? xNormalized.containers.length : 0;

            for (let yInstance of yNormalized.instances) {
                xNormalized.instances.push(yInstance);

                if (yInstance.containerIdx != null)
                    yInstance.containerIdx += xCategoryCount;
            }

            let yContainers = yNormalized.containers;
            if (!_.isEmpty(yContainers)) {
                if (xNormalized.containers)
                    Array.prototype.push.apply(xNormalized.containers, yContainers);
                else
                    xNormalized.containers = yContainers;
            }

            return xNormalized;
        }

        public static normalize(x: VisualObjectInstanceEnumeration): VisualObjectInstanceEnumerationObject {
            debug.assertAnyValue(x, 'x');

            if (_.isArray(x)) {
                return { instances: <VisualObjectInstance[]>x };
            }

            return <VisualObjectInstanceEnumerationObject>x;
        }
    }
}