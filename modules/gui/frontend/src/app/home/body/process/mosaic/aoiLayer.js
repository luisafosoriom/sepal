import {connect} from 'store'
import {selectFrom} from 'collections'
import {sepalMap} from 'app/home/map/map'
import {setAoiLayer} from 'app/home/map/aoiLayer'
import {withRecipe} from 'app/home/body/process/recipeContext'
import React from 'react'

const mapStateToProps = state => ({
    tabCount: state.process.tabs.length
})

const mapRecipeToProps = recipe => ({
    recipeId: recipe.id,
    aoi: selectFrom(recipe, 'model.aoi')
})

class AoiLayer extends React.Component {
    render() {
        return null
    }

    componentDidMount() {
        const {recipeId, aoi, tabCount, componentWillUnmount$} = this.props
        setAoiLayer({
            contextId: recipeId,
            aoi,
            destroy$: componentWillUnmount$,
            onInitialized: () => {
                if (tabCount === 1) {
                    sepalMap.setContext(recipeId)
                    sepalMap.getContext(recipeId).fitLayer('aoi')
                }
            }
        })
    }
}

export default (
    withRecipe(mapRecipeToProps)(
        connect(mapStateToProps)(
            AoiLayer
        )
    )
)